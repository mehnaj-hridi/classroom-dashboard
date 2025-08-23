#include <SPI.h>
#include <MFRC522.h>
#include <math.h>

// ----- RFID Pins -----
#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

// ----- Sound Sensor + LED -----
const int micPin = A0;    // Analog input for microphone
const int ledPin = 6;     // LED on pin 6 (PWM capable)

// Settings
const unsigned long sampleWindow = 200; // ms for RMS averaging
const float referenceVoltage = 5.0;     // Arduino UNO ADC reference
const int adcMax = 1023;
const float adcMid = adcMax / 2.0;      // expected bias ~512

// Calibration
float calibration_offset = 40.0; // adjust based on phone SPL app
float threshold_dB = 30.0;       // LED turns on at this dB

void setup() {
  // RFID setup
  Serial.begin(115200);
  Serial.println("=== System Starting... ===");
  Serial.println("Initializing RFID...");
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("RFID Initialized! Place your card near the reader.");

  // LED setup
  pinMode(ledPin, OUTPUT);
  Serial.println("LED pin set as OUTPUT.");
}

void loop() {
  Serial.println("\n--- Loop Started ---");

  // -------- RFID Reading --------
  Serial.println("Checking for RFID card...");
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("Card detected! UID: ");
    for (byte i = 0; i < rfid.uid.size; i++) {
      Serial.print(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      Serial.print(rfid.uid.uidByte[i], HEX);
      if (i != rfid.uid.size - 1) Serial.print(":");
    }
    Serial.println();
    Serial.println("Card read complete.");
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  } else {
    Serial.println("No card detected.");
  }

  // -------- Sound Level Measurement --------
  Serial.println("Starting sound level measurement...");
  unsigned long startMillis = millis();
  unsigned long sampleCount = 0;
  double sumSquares = 0;

  while (millis() - startMillis < sampleWindow) {
    int sample = analogRead(micPin);
    double centered = sample - adcMid; // remove DC bias
    sumSquares += centered * centered;
    sampleCount++;
  }
  Serial.print("Collected samples: ");
  Serial.println(sampleCount);

  if (sampleCount > 0) {
    double meanSquare = sumSquares / sampleCount;
    double rms = sqrt(meanSquare);

    double Vrms = (rms * referenceVoltage) / adcMax;

    double dB = -100.0;
    if (Vrms > 0.000001) {
      dB = 20.0 * log10(Vrms) + calibration_offset;
    }

    Serial.print("Vrms: ");
    Serial.print(Vrms, 6);
    Serial.print(" V | SPL: ");
    Serial.print(dB, 1);
    Serial.println(" dB");

    if (dB >= threshold_dB) {
      Serial.println("Sound above threshold -> Turning LED ON");
      digitalWrite(ledPin, HIGH);
    } else {
      Serial.println("Sound below threshold -> Turning LED OFF");
      digitalWrite(ledPin, LOW);
    }
  } else {
    Serial.println("No samples collected!");
  }

  Serial.println("--- Loop End ---");
  delay(500); // make output more readable
}
