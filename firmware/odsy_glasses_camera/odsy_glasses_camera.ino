// Odsy glasses: touch IO13 (ground it) to take a photo, sign it with the device's secp256k1 key,
// and POST it to the gateway's /api/ingest. Enroll the device at /enroll first or uploads get 403.
#include "esp_camera.h"
#include "img_converters.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>
#include "esp_random.h"
#include "mbedtls/base64.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "odsy_crypto.h"

// ==================== 1. SETTINGS ====================
// Tried in order at boot. If none connects, the glasses ask for a network over Serial
// (laptop -> USB -> UART bridge ESP32 -> cam), 115200 baud, line ending "Newline".
const char* WIFI_NETWORKS[][2] = {
  {"AatifPhone", "thug4life"},
  {"Ekas's iPhone", "treepsake777"},
};

// Your deployed app (https) or a local `next dev` (http://<laptop-ip>:3000/api/ingest).
const char* ingestUrl = "https://odyssey-blush-seven.vercel.app/api/ingest";

// shortcut: no GPS on the glasses, every photo is signed at Bandra West, Mumbai (same as scripts/simulate-device.ts);
// replace with a GPS fix once the hardware has one. Decimal strings, at most 9 decimals, as /api/ingest validates them.
const char* DEVICE_LAT = "19.0596";
const char* DEVICE_LON = "72.8295";

// ==================== 2. HARDWARE PINS ====================
#define TRIGGER_PIN   13   // touch to GND = LOW (internal pull-up)
#define I2C_SDA       15   // OLED SDA (keeps camera pins 21/22 free)
#define I2C_SCL       14   // OLED SCL

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

TwoWire I2Cbus = TwoWire(0);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &I2Cbus, OLED_RESET);

// AI-Thinker camera pins
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

// ==================== 3. DEVICE KEY ====================
uint8_t devicePrivateKey[32];
char deviceAddress[43];

static int hwRandom(void*, unsigned char* out, size_t len) {
  esp_fill_random(out, len);  // hardware RNG; RF on (Wi-Fi) makes it a true RNG
  return 0;
}

// ==================== OLED SCREENS ====================
// Text is 6 px per character at size 1 (21 per line), 12 px at size 2 (10 per line).
void centered(const char* text, int y, int size = 1) {
  display.setTextSize(size);
  int w = strlen(text) * 6 * size;
  display.setCursor(w < SCREEN_WIDTH ? (SCREEN_WIDTH - w) / 2 : 0, y);
  display.print(text);
}

// Inverted title bar, one large headline, two small lines.
void screen(const char* title, const char* headline, const char* line1 = "", const char* line2 = "") {
  display.clearDisplay();
  display.fillRect(0, 0, SCREEN_WIDTH, 11, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  centered(title, 2);
  display.setTextColor(SSD1306_WHITE);
  centered(headline, 17, 2);
  centered(line1, 41);
  centered(line2, 53);
  display.display();
}

void halt(const char* why) {
  screen("ODYSSEY", "Error", why, "Restart the glasses");
  Serial.println(why);
  while (true) delay(1000);
}

// The key is generated once and kept in flash (NVS). The address is derived from it on every boot.
void initDeviceKey() {
  Preferences prefs;
  prefs.begin("odsy", false);
  if (prefs.getBytes("privkey", devicePrivateKey, 32) != 32) {
    if (odsy_new_key(devicePrivateKey, hwRandom, nullptr)) halt("keygen failed");
    prefs.putBytes("privkey", devicePrivateKey, 32);
  }
  prefs.end();
  if (odsy_address(devicePrivateKey, deviceAddress, hwRandom, nullptr)) halt("secp256k1 unavailable");
}

// ==================== 4. CAPTURE & UPLOAD ====================
int uploadSigned(const uint8_t* jpg, size_t jpgLen, long capturedAt) {
  char contentHash[67], sensorsHash[67];
  const char* sensors = "{}";
  odsy_sha256_hex(jpg, jpgLen, contentHash);
  odsy_sha256_hex((const uint8_t*)sensors, strlen(sensors), sensorsHash);

  // Must match signedText() in web-monorepo/apps/web/lib/sample.ts exactly.
  char message[256];
  snprintf(message, sizeof message, "odsy-sample:v1|%s|image|image/jpeg|%ld|%s|%s|%s",
           contentHash, capturedAt, DEVICE_LAT, DEVICE_LON, sensorsHash);
  char signature[133];
  if (odsy_sign_message(devicePrivateKey, message, signature, hwRandom, nullptr)) return -100;

  size_t b64Len = 0;
  mbedtls_base64_encode(nullptr, 0, &b64Len, jpg, jpgLen);  // size probe
  size_t cap = b64Len + 512;
  char* body = (char*)malloc(cap);
  if (!body) return -101;
  int n = snprintf(body, cap,
                   "{\"kind\":\"image\",\"mime\":\"image/jpeg\",\"capturedAt\":%ld,\"lat\":\"%s\",\"lon\":\"%s\","
                   "\"sensors\":\"{}\",\"signature\":\"%s\",\"data\":\"",
                   capturedAt, DEVICE_LAT, DEVICE_LON, signature);
  size_t written = 0;
  mbedtls_base64_encode((unsigned char*)body + n, cap - n, &written, jpg, jpgLen);
  n += written;
  n += snprintf(body + n, cap - n, "\"}");

  HTTPClient http;
  WiFiClientSecure tls;
  WiFiClient plain;
  if (strncmp(ingestUrl, "https", 5) == 0) {
    // shortcut: no CA pinning; the photo is signed so tampering is detected, but a MITM could drop it. Pin the CA for production.
    tls.setInsecure();
    http.begin(tls, ingestUrl);
  } else {
    http.begin(plain, ingestUrl);
  }
  http.setTimeout(30000);  // the gateway writes to Arkiv before it answers
  http.addHeader("Content-Type", "application/json");
  int code = http.POST((uint8_t*)body, n);
  String reply = http.getString();
  Serial.printf("POST %d: %s\n", code, reply.c_str());
  http.end();
  free(body);
  // The gateway also answers 403 for a banned World ID; tell the two apart on screen.
  return code == 403 && reply.indexOf("banned") >= 0 ? -403 : code;
}

void captureAndSend(camera_fb_t* fb) {
  display.invertDisplay(true);  // shutter flash
  delay(80);
  display.invertDisplay(false);

  time_t now = time(nullptr);
  uint8_t* jpg = nullptr;
  size_t jpgLen = 0;
  if (WiFi.status() != WL_CONNECTED) {
    screen("NO CONNECTION", "No Wi-Fi", "Check the hotspot", "then touch again");
  } else if (now < 1700000000) {
    screen("NOT READY", "No clock", "Waiting for time sync", "Try again shortly");
  } else if (!fmt2jpg(fb->buf, fb->len, fb->width, fb->height, PIXFORMAT_GRAYSCALE, 85, &jpg, &jpgLen)) {
    screen("CAPTURE FAILED", "Camera", "Image encode failed", "Touch to retry");
  } else {
    screen("CAPTURE", "Sending", "Signing on device", "Uploading to Odyssey");
    int code = uploadSigned(jpg, jpgLen, (long)now);
    free(jpg);
    char detail[22];
    snprintf(detail, sizeof detail, "Server code %d", code);
    if (code == 201) screen("ODYSSEY", "Image sent", "Signed and stored", "Touch for another");
    else if (code == 409) screen("ODYSSEY", "Duplicate", "Image already stored", "Touch for another");
    else if (code == 403) screen("NOT ENROLLED", "Blocked", "Enroll this device", "at Odyssey /enroll");
    else if (code == -403) screen("ACCESS DENIED", "Banned", "This World ID is", "banned by consensus");
    else screen("UPLOAD FAILED", "Not sent", detail, "Touch to retry");
  }
  delay(2000);  // keep the result readable
}

// ==================== 5. WI-FI ====================
bool connectWifi(const char* ssid, const char* pass) {
  char name[22];
  snprintf(name, sizeof name, "%s", ssid);
  screen("WI-FI", "Joining", name, "");
  Serial.printf("Wi-Fi: trying \"%s\"\n", ssid);
  WiFi.disconnect();
  delay(100);
  WiFi.begin(ssid, pass);
  for (int i = 0; i < 25 && WiFi.status() != WL_CONNECTED; i++) delay(400);  // ~10 s
  bool ok = WiFi.status() == WL_CONNECTED;
  Serial.println(ok ? "Wi-Fi: connected" : "Wi-Fi: failed");
  return ok;
}

// Blocks until a line arrives over Serial. Strips the line ending only, so spaces in passwords survive.
String readSerialLine(const char* prompt) {
  Serial.print(prompt);
  while (!Serial.available()) delay(10);
  String s = Serial.readStringUntil('\n');
  if (s.endsWith("\r")) s.remove(s.length() - 1);
  return s;
}

void setupWifi() {
  WiFi.mode(WIFI_STA);
  for (auto& net : WIFI_NETWORKS) {
    if (connectWifi(net[0], net[1])) return;
  }
  // No known network: ask over the UART bridge until one connects.
  while (true) {
    screen("WI-FI SETUP", "No Wi-Fi", "Open Serial 115200", "Enter SSID+password");
    Serial.println("\nNo known Wi-Fi found. Type the network below (Serial Monitor: 115200 baud, line ending Newline).");
    String ssid = readSerialLine("SSID: ");
    Serial.println(ssid);
    String pass = readSerialLine("Password: ");
    Serial.println("********");
    if (connectWifi(ssid.c_str(), pass.c_str())) return;
    Serial.println("Could not connect. Check the name and password and try again.");
  }
}

// ==================== 6. SETUP & LOOP ====================
String mac;

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // disable brownout resets
  Serial.begin(115200);
  pinMode(TRIGGER_PIN, INPUT_PULLUP);  // HIGH at rest; touching IO13 to GND (e.g. the metal shield) pulls it LOW

  I2Cbus.begin(I2C_SDA, I2C_SCL, 100000);
  display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS, true, false);
  screen("ODYSSEY", "Welcome", "Proof of reality", "Connecting Wi-Fi...");

  setupWifi();  // returns only once connected
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // capturedAt is signed unix time
  screen("ODYSSEY", "Welcome", "Wi-Fi connected", "Syncing clock...");
  for (int i = 0; i < 20 && time(nullptr) < 1700000000; i++) delay(500);

  screen("ODYSSEY", "Welcome", "Loading device key...", "");
  initDeviceKey();
  mac = WiFi.macAddress();
  Serial.printf("Device address: %s\nWi-Fi MAC:      %s\n", deviceAddress, mac.c_str());

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
  config.frame_size   = FRAMESIZE_QQVGA;  // 160x120
  config.jpeg_quality = 12;
  config.fb_count     = 1;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    char msg[24];
    snprintf(msg, sizeof msg, "Cam Error: 0x%x", err);
    halt(msg);
  }

  showDeviceId();
  delay(15000);  // time to copy the address and MAC into /enroll (also printed on Serial)
}

// The address split over two lines (21 chars each) so it can be typed into /enroll.
void showDeviceId() {
  char a1[22], a2[22], m[22];
  memcpy(a1, deviceAddress, 21); a1[21] = 0;
  memcpy(a2, deviceAddress + 21, 21); a2[21] = 0;
  snprintf(m, sizeof m, "MAC %s", mac.c_str());
  display.clearDisplay();
  display.fillRect(0, 0, SCREEN_WIDTH, 11, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  centered("DEVICE ID", 2);
  display.setTextColor(SSD1306_WHITE);
  centered(a1, 16);
  centered(a2, 26);
  centered(m, 40);
  centered("Enroll at /enroll", 54);
  display.display();
}

void loop() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("camera: no frame");
    delay(100);
    return;
  }

  // Grounding IO13 fires once; it re-arms after the pin has been back HIGH for 100 ms,
  // so a wire bouncing on the metal shield does not fire twice.
  static bool armed = true;
  static int lastBtn = HIGH;
  static unsigned long highSince = 0;
  int btn = digitalRead(TRIGGER_PIN);
  if (btn != lastBtn) Serial.printf("IO13 -> %d\n", btn);
  lastBtn = btn;
  if (btn == HIGH) {
    if (!highSince) highSince = millis();
    if (millis() - highSince >= 100) armed = true;
  } else {
    highSince = 0;
  }

  if (btn == LOW && armed) {
    armed = false;
    captureAndSend(fb);
    esp_camera_fb_return(fb);
    return;
  }

  // Live viewfinder with a status bar on top and the hint at the bottom
  display.clearDisplay();
  for (int y = 0; y < 64; y++) {
    int row = (y * 120 / 64) * 160;
    for (int x = 0; x < 128; x++) {
      if (fb->buf[row + x * 160 / 128] > THRESHOLD) display.drawPixel(x, y, SSD1306_WHITE);
    }
  }
  esp_camera_fb_return(fb);
  display.fillRect(0, 0, SCREEN_WIDTH, 10, SSD1306_BLACK);
  display.fillRect(0, 54, SCREEN_WIDTH, 10, SSD1306_BLACK);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(1, 1);
  display.print("ODYSSEY");
  display.setCursor(SCREEN_WIDTH - 6 * 7 - 1, 1);
  display.print(WiFi.status() == WL_CONNECTED ? "  READY" : "NO WIFI");
  centered(btn == LOW ? "Release to re-arm" : "Touch to send image", 55);
  display.display();
}
