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
const char* ssid     = "Aatif";
const char* password = "thug4life";

// Your deployed app (https) or a local `next dev` (http://<laptop-ip>:3000/api/ingest).
const char* ingestUrl = "https://YOUR-APP.vercel.app/api/ingest";

// No GPS on the glasses: every photo is signed with this fixed location. Set it to where you test.
// Decimal strings, at most 9 decimals, as /api/ingest validates them.
const char* DEVICE_LAT = "0.0";
const char* DEVICE_LON = "0.0";

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

void showLines(const char* a, const char* b = "", const char* c = "", const char* d = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  const char* lines[] = {a, b, c, d};
  for (int i = 0; i < 4; i++) {
    display.setCursor(0, i * 16);
    display.print(lines[i]);
  }
  display.display();
}

void halt(const char* why) {
  showLines("ERROR", why);
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
  Serial.printf("POST %d: %s\n", code, http.getString().c_str());
  http.end();
  free(body);
  return code;
}

void captureAndSend(camera_fb_t* fb) {
  display.invertDisplay(true);
  delay(80);
  display.invertDisplay(false);
  showLines("CAPTURED", "Signing + sending...");

  time_t now = time(nullptr);
  uint8_t* jpg = nullptr;
  size_t jpgLen = 0;
  char line[24];
  if (WiFi.status() != WL_CONNECTED) {
    showLines("WiFi not connected");
  } else if (now < 1700000000) {
    showLines("No clock (NTP)", "Check Wi-Fi");
  } else if (!fmt2jpg(fb->buf, fb->len, fb->width, fb->height, PIXFORMAT_GRAYSCALE, 85, &jpg, &jpgLen)) {
    showLines("JPEG encode failed");
  } else {
    int code = uploadSigned(jpg, jpgLen, (long)now);
    free(jpg);
    snprintf(line, sizeof line, "HTTP %d", code);
    if (code == 201) showLines("SAVED + SIGNED", line);
    else if (code == 403) showLines("NOT ENROLLED", line, "Enroll at /enroll");
    else showLines("UPLOAD FAILED", line, "See serial log");
  }
  delay(1500);
}

// ==================== 5. SETUP & LOOP ====================
bool started = false;  // the boot screen shows the address until the first touch

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // disable brownout resets
  Serial.begin(115200);
  pinMode(TRIGGER_PIN, INPUT_PULLUP);

  I2Cbus.begin(I2C_SDA, I2C_SCL, 100000);
  display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS, true, false);
  showLines("Odsy Glasses", "Connecting WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  for (int i = 0; i < 25 && WiFi.status() != WL_CONNECTED; i++) delay(400);
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // capturedAt is signed unix time

  initDeviceKey();
  String mac = WiFi.macAddress();
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

  // Address split over two lines (21 chars each) so it can be typed into /enroll.
  char a1[22], a2[22];
  memcpy(a1, deviceAddress, 21); a1[21] = 0;
  memcpy(a2, deviceAddress + 21, 21); a2[21] = 0;
  showLines(a1, a2, mac.c_str(), WiFi.status() == WL_CONNECTED ? "Touch to start" : "WiFi offline!");
}

void loop() {
  int btn = digitalRead(TRIGGER_PIN);
  static int lastBtn = HIGH;
  bool pressed = btn == LOW && lastBtn == HIGH;
  lastBtn = btn;

  if (!started) {
    if (pressed) started = true;
    delay(20);
    return;
  }

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return;

  if (pressed) {
    captureAndSend(fb);
    esp_camera_fb_return(fb);
    return;
  }

  // Live viewfinder on the OLED
  display.clearDisplay();
  for (int y = 0; y < 64; y++) {
    int row = (y * 120 / 64) * 160;
    for (int x = 0; x < 128; x++) {
      if (fb->buf[row + x * 160 / 128] > THRESHOLD) display.drawPixel(x, y, SSD1306_WHITE);
    }
  }
  display.fillRect(0, 0, 48, 9, SSD1306_BLACK);
  display.setCursor(1, 1);
  display.printf("BTN:%d", btn);
  display.display();
  esp_camera_fb_return(fb);
}
