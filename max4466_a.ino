#include <math.h>

// Pins
const int micPin = A0;
const int ledPin = 11;

// Settings
const unsigned long sampleWindow = 200; // ms for RMS averaging
const float referenceVoltage = 5.0;     // Arduino UNO ADC reference
const int adcMax = 1023;
const float adcMid = adcMax / 2.0;      // expected bias ~512

// Calibration
float calibration_offset = 40.0; // adjust based on phone SPL app
float threshold_dB = 30.0;       // LED turns on at this dB

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(115200);
  Serial.println("Sound level meter starting...");
}

void loop() {
  unsigned long startMillis = millis();
  unsigned long sampleCount = 0;
  double sumSquares = 0;

  // Collect samples
  while (millis() - startMillis < sampleWindow) {
    int sample = analogRead(micPin);
    double centered = sample - adcMid; // remove DC bias
    sumSquares += centered * centered;
    sampleCount++;
  }

  if (sampleCount == 0) return;

  // RMS in ADC counts
  double meanSquare = sumSquares / sampleCount;
  double rms = sqrt(meanSquare);

  // Convert to Vrms
  double Vrms = (rms * referenceVoltage) / adcMax;

  // Convert to dB (approx, needs calibration)
  double dB = -100.0;
  if (Vrms > 0.000001) {
    dB = 20.0 * log10(Vrms) + calibration_offset;
  }

  // Debug print
  Serial.print("Vrms: ");
  Serial.print(Vrms, 6);
  Serial.print(" V | SPL: ");
  Serial.print(dB, 1);
  Serial.println(" dB");

  // LED control
  if (dB >= threshold_dB) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }

  delay(50); // short pause
}
