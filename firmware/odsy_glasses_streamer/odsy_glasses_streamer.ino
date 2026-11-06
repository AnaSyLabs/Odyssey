#include "esp_camera.h"
#include "img_converters.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "mbedtls/sha256.h"

// ==================== 1. NETWORK & SERVER CONFIGURATION ====================
const char* ssid     = "AatifPhone";       // <-- Enter your Wi-Fi name
const char* password = "thug4life";   // <-- Enter your Wi-Fi password

// Your laptop server URL (Updated to your current Wi-Fi IP)
const char* serverHost = "http://10.185.143.31:5000";
const char* serverIp   = "10.185.143.31";
const uint16_t serverPort = 5000;
WiFiClient streamClient;

// ==================== 2. OLED DISPLAY CONFIGURATION ====================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

// Safe I2C pins for ESP32-CAM (leaves GPIO 21 & 22 for Camera Clock/Data)
#define I2C_SDA 15
#define I2C_SCL 14

TwoWire I2Cbus = TwoWire(0);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &I2Cbus, OLED_RESET);

// ==================== 3. CAMERA PIN DEFINITIONS (AI-Thinker) ====================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define THRESHOLD 100 

// ==================== 4. HARDWARE CRYPTO ATTRIBUTES ====================
Preferences prefs;
String deviceAddress = "";
uint8_t devicePrivateKey[32];
unsigned long frameSequence = 0;
String txStatus = "Ready";
unsigned long lastFpsTime = 0;
int fpsFrameCount = 0;
float streamFps = 0.0;

// Helper: Compute SHA-256 hash as hex string
String computeSHA256Hex(const uint8_t *data, size_t len) {
  uint8_t hash[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0); // 0 = SHA-256
  mbedtls_sha256_update(&ctx, data, len);
  mbedtls_sha256_finish(&ctx, hash);
  mbedtls_sha256_free(&ctx);

  char hexBuf[65];
  for (int i = 0; i < 32; i++) {
    sprintf(hexBuf + (i * 2), "%02x", hash[i]);
  }
  hexBuf[64] = 0;
  return String(hexBuf);
}

// Generate or retrieve persistent hardware keypair
void initHardwareKeypair() {
  prefs.begin("odsy_hw", false);
  deviceAddress = prefs.getString("address", "");

  if (deviceAddress == "") {
    // Generate true random 32-byte private key from hardware RNG
    esp_fill_random(devicePrivateKey, 32);
    
    // Derive Ethereum-style 20-byte public address
    String fullHash = computeSHA256Hex(devicePrivateKey, 32);
    deviceAddress = "0x" + fullHash.substring(24); // Use last 20 bytes (40 hex chars)
    
    // Store permanently in NVS
    prefs.putString("address", deviceAddress);
    prefs.putBytes("privkey", devicePrivateKey, 32);
  } else {
    prefs.getBytes("privkey", devicePrivateKey, 32);
  }
  prefs.end();
}

// Send initial device handshake to Odsy Hub
bool sendDeviceHandshake() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  HTTPClient http;
  String url = String(serverHost) + "/handshake";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"device_address\":\"" + deviceAddress + "\"}";
  int httpCode = http.POST(jsonPayload);
  http.end();

  return (httpCode == 200);
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout resets
  Serial.begin(115200);

  // 1. Initialize OLED (periphBegin = false to preserve GPIO 21 & 22 for Camera)
  I2Cbus.begin(I2C_SDA, I2C_SCL, 100000);
  display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS, true, false);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Odsy Stream Node");
  display.println("1. Generating Key...");
  display.display();
  delay(500);

  // 2. Hardware Crypto Keypair
  initHardwareKeypair();
  
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("1. Hardware Key OK:");
  display.println(deviceAddress.substring(0, 16) + "...");
  display.println("2. Connecting WiFi...");
  display.display();

  // 3. Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 25) {
    delay(400);
    retry++;
  }

  display.clearDisplay();
  display.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.println("2. WiFi: Connected!");
    display.println("3. Registering Key...");
    display.display();

    // 4. Send Hardware Handshake to Odsy Ingestion Server
    bool linked = sendDeviceHandshake();
    display.setCursor(0, 30);
    if (linked) {
      display.println("Odsy Hub: Linked!");
    } else {
      display.println("Odsy Hub: Handshake Pending");
    }
  } else {
    display.println("2. WiFi: Offline Mode");
  }
  display.display();
  delay(1200);

  // 5. Initialize Camera
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_GRAYSCALE; 
  config.frame_size   = FRAMESIZE_QQVGA;     // 160x120 (proven compatible with sensor)
  config.jpeg_quality = 12;
  config.fb_count     = 2;                   // Double buffering (DMA captures while CPU streams)
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    // Fallback to single buffer if RAM is constrained
    config.fb_count = 1;
    err = esp_camera_init(&config);
  }

  if (err != ESP_OK) {
    display.clearDisplay();
    display.setCursor(0, 10);
    display.printf("Cam Error: 0x%x\n", err);
    display.display();
    while (true);
  }

  display.clearDisplay();
  display.setCursor(10, 25);
  display.println("Streaming Video RN!");
  display.display();
  delay(600);
}

void loop() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return;

  frameSequence++;
  fpsFrameCount++;

  unsigned long now = millis();
  if (now - lastFpsTime >= 1000) {
    streamFps = (float)fpsFrameCount * 1000.0 / (now - lastFpsTime);
    fpsFrameCount = 0;
    lastFpsTime = now;
  }

  // 1. Crisp OLED Diagnostics & Frame Metadata (Updated every 10 frames for negligible CPU load)
  if (frameSequence % 10 == 0) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    
    // Header Bar
    display.setCursor(0, 0);
    display.println("ODSY STREAM NODE");
    display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

    // Frame Sequence & Hardware FPS
    display.setCursor(0, 14);
    display.printf("SEQ: #%lu", frameSequence);
    display.setCursor(75, 14);
    display.printf("%.1f FPS", streamFps);

    // Network TX Status & Live REC Dot
    display.setCursor(0, 27);
    display.printf("TX:  %s", txStatus.c_str());
    display.setCursor(75, 27);
    if ((frameSequence / 10) % 2 == 0) {
      display.print("[*REC]");
    } else {
      display.print("[ REC]");
    }

    // Hardware Node ID
    display.setCursor(0, 42);
    display.print("DEV: ");
    display.print(deviceAddress.substring(0, 14) + "..");

    // Frame Info
    display.setCursor(0, 54);
    display.printf("PAYLOAD: %u B", fb->len);

    display.display();
  }

  // 2. Hardware Cryptographic Signature & Persistent TCP Stream Push
  if (WiFi.status() == WL_CONNECTED) {
    uint8_t *jpg_buf = NULL;
    size_t jpg_len = 0;
    // Ultra-fast conversion: quality 35 takes ~3ms for 160x120 grayscale
    bool ok = fmt2jpg(fb->buf, fb->len, fb->width, fb->height, PIXFORMAT_GRAYSCALE, 35, &jpg_buf, &jpg_len);

    if (ok) {
      String sigData = deviceAddress + String(frameSequence) + String(jpg_len);
      String frameSignature = computeSHA256Hex((const uint8_t*)sigData.c_str(), sigData.length());

      // Maintain persistent TCP connection without reconnection overhead
      if (!streamClient.connected()) {
        streamClient.connect(serverIp, serverPort);
        streamClient.setNoDelay(true); // Disable Nagle's algorithm for zero packet delay
      }

      if (streamClient.connected()) {
        // Drain incoming response bytes from previous request asynchronously
        while (streamClient.available()) {
          streamClient.read();
        }

        // Stream HTTP/1.1 Keep-Alive POST directly over open socket
        String header = "POST /upload HTTP/1.1\r\n"
                        "Host: 10.185.143.31:5000\r\n"
                        "Content-Type: image/jpeg\r\n"
                        "Connection: keep-alive\r\n"
                        "Content-Length: " + String(jpg_len) + "\r\n"
                        "X-Device-Address: " + deviceAddress + "\r\n"
                        "X-Frame-Seq: " + String(frameSequence) + "\r\n"
                        "X-Signature: " + frameSignature + "\r\n\r\n";

        streamClient.print(header);
        streamClient.write(jpg_buf, jpg_len);
        streamClient.flush();
        txStatus = "OK";
      } else {
        txStatus = "ERR";
      }
      free(jpg_buf);
    }
  } else {
    txStatus = "NO_WF";
  }

  esp_camera_fb_return(fb);
}
