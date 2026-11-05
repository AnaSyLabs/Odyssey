export const RIGHT = ["D23", "D22", "TX0", "RX0", "D21", "D19", "D18", "D5", "TX2", "RX2", "D4", "D2", "D15", "GND", "3V3"];
export const LEFT = ["EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"];

export const PITCH = 2.54;
export const pinY = (i: number) => 9.27 + i * PITCH;
export const PIN_X_RIGHT = 26.4;

export type Wire = { pin: string; label: string; part: string; from: number; to: [number, number]; color: string; lesson: number };

// Every signal pin sits on the right header, so the wires stay short and uncrossed.
export const WIRES: Wire[] = [
  { pin: "3V3", label: "Power +", part: "Rail +", from: 14, to: [48.2, 44.9], color: "#D93829", lesson: 0 },
  { pin: "GND", label: "Ground", part: "Rail −", from: 13, to: [50.74, 42.36], color: "#2B6CB0", lesson: 0 },
  { pin: "D23", label: "I²S data (SD)", part: "INMP441 mic", from: 0, to: [59.58, 22.04], color: "#3A9D5B", lesson: 1 },
  { pin: "D19", label: "I²S word select (WS)", part: "INMP441 mic", from: 5, to: [62.12, 22.04], color: "#E58A2E", lesson: 1 },
  { pin: "D18", label: "I²S clock (SCK)", part: "INMP441 mic", from: 6, to: [64.66, 22.04], color: "#7B4FA3", lesson: 1 },
  { pin: "D22", label: "I²C clock (SCL)", part: "SSD1306 OLED", from: 1, to: [73.58, 24.58], color: "#188078", lesson: 2 },
  { pin: "D21", label: "I²C data (SDA)", part: "SSD1306 OLED", from: 4, to: [76.12, 24.58], color: "#C2528B", lesson: 2 },
  { pin: "D15", label: "Beep", part: "Buzzer", from: 12, to: [59.58, 39.82], color: "#8A6D1F", lesson: 2 },
  { pin: "D4", label: "IR illuminator", part: "850 nm IR LED", from: 10, to: [54.5, 37.28], color: "#D4572B", lesson: 3 },
];

export type Region = "module" | "headerR" | "headerL" | "usb" | "buttons";
export const REGIONS: Record<Region, { title: string; text: string; rect: [number, number, number, number]; z: number }> = {
  module: { title: "ESP32-WROOM-32", text: "Dual-core 240 MHz with Wi-Fi + BLE. Records clips, hashes and signs them, and uploads to a gateway.", rect: [5, 2, 18, 25.5], z: 5 },
  headerR: { title: "Right header (15 pins)", text: "D23 D22 TX0 RX0 D21 D19 D18 D5 TX2 RX2 D4 D2 D15 GND 3V3. Carries all seven signal wires plus power.", rect: [25.1, 7.7, 2.6, 38.6], z: 9 },
  headerL: { title: "Left header (15 pins)", text: "EN VP VN D34 D35 D32 D33 D25 D26 D27 D14 D12 D13 GND VIN. Free for the camera, IMU and secure element.", rect: [0.3, 7.7, 2.6, 38.6], z: 9 },
  usb: { title: "Micro-USB", text: "5 V power and the serial link used for flashing and the Serial Monitor.", rect: [9.5, 51, 9, 7], z: 4.4 },
  buttons: { title: "EN / BOOT", text: "EN resets the chip. Hold BOOT while resetting to enter flashing mode.", rect: [4.5, 48, 19, 4.5], z: 3.4 },
};

export const LESSONS = [
  { id: "boot", title: "Boot & wiring", blurb: "Power the rails and bring up Wi-Fi." },
  { id: "capture", title: "Capture", blurb: "The I²S mic records a short clip alongside the camera and IMU." },
  { id: "consent", title: "REC indicator", blurb: "The OLED shows REC and the buzzer chirps, so bystanders know." },
  { id: "gaze", title: "Gaze", blurb: "The 850 nm IR LED lights the eye so the camera can track where the wearer looks." },
  { id: "sign", title: "Sign & upload", blurb: "Hash the clip, sign it with the device key, upload to a gateway." },
] as const;

// Reference firmware, shown in the editor. Each line carries the lesson it belongs to.
// shortcut: display only, nothing flashes or runs it.
export const SKETCH: [string, number | null][] = [
  ["// Odyssey capture node: reference firmware sketch", null],
  ["#include <WiFi.h>", null],
  ["#include <HTTPClient.h>", null],
  ["#include <driver/i2s.h>", null],
  ["#include <Adafruit_SSD1306.h>", null],
  ["#include <mbedtls/sha256.h>", null],
  ["", null],
  ["const int I2S_SCK = 18, I2S_WS = 19, I2S_SD = 23;  // mic", null],
  ["const int OLED_SDA = 21, OLED_SCL = 22;            // REC indicator", null],
  ["const int IR_LED = 4, BUZZER = 15;", null],
  ['const char* GATEWAY = "https://gateway.odyssey.xyz";', null],
  ["Adafruit_SSD1306 hud(128, 64, &Wire, -1);", null],
  ["", null],
  ["void setup() {", 0],
  ["  Serial.begin(115200);", 0],
  ["  pinMode(IR_LED, OUTPUT);", 0],
  ["  pinMode(BUZZER, OUTPUT);", 0],
  ["  Wire.begin(OLED_SDA, OLED_SCL);", 0],
  ["  hud.begin(SSD1306_SWITCHCAPVCC, 0x3C);", 0],
  ["  WiFi.begin(SSID, PASS);", 0],
  ["}", null],
  ["", null],
  ["void loop() {", null],
  ["  if (!captureRequested()) return;     // double-tap", 1],
  ["  Clip clip = recordClip(10);          // audio + frames + IMU", 1],
  ['  hud.print("REC");                    // visible to bystanders', 2],
  ["  beep(1);", 2],
  ["  digitalWrite(IR_LED, HIGH);          // gaze frames", 3],
  ["  clip.gaze = trackGaze();", 3],
  ["  digitalWrite(IR_LED, LOW);", 3],
  ["  uint8_t h[32]; sha256(clip, h);", 4],
  ["  Sig s = secureElementSign(h, now()); // key never leaves the chip", 4],
  ['  post(GATEWAY "/samples", clip, s);', 4],
  ["  beep(2);", 4],
  ["}", null],
]
