#include <SPI.h>

#define SS 9

long delays[] = {4011, -3875, 561, -1906, 561, -1906, 561, -1906, 561, -1906, 561, -921, 561, -921, 561, -1906, 561, -921, 561, -1906, 561, -921, 561, -1906, 561, -921, 561, -921, 561, -921, 561, -921, 561, -921, 561, -1906, 561, -921, 561, -1906, 561, -921, 561, -921, 561, -921, 561, -921, 561, -921};
const char tx_length = 48;

#define ACK_CMD 0
#define FIRMWARE_CMD 1
#define TX_CMD 2
#define RX_CMD 3
#define IR_TX_ON 4
#define IR_TX_OFF 5
#define TX_RD_CMD 7

char expectedTop;
char actualTop;
char expectedBottom;
char actualBottom;


void setup() {
  // put your setup code here, to run once:
  pinMode(SS,OUTPUT);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
  SPI.setDataMode(SPI_MODE0);
  SPI.setBitOrder(MSBFIRST);
  SPI.begin();
  Serial.begin(115200);

}

void loop() {
  //Test ACK
  
  
  digitalWrite(SS,LOW);
  delayMicroseconds(100);
  Serial.println(SPI.transfer(ACK_CMD));
  delayMicroseconds(100);
  Serial.println(SPI.transfer(0x00));
  delayMicroseconds(100);
  Serial.println(SPI.transfer(0x00));
  digitalWrite(SS,HIGH);
//  
//  digitalWrite(SS,LOW);
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(FIRMWARE_CMD));
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(0x00));
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(0x00));
//  digitalWrite(SS,HIGH);
//  
//  delayMicroseconds(500);
//  
//  digitalWrite(SS, LOW);
//  delayMicroseconds(500);
//  Serial.println(SPI.transfer(IR_TX_ON));
//  delayMicroseconds(500);
//  Serial.println(SPI.transfer(0x00));
//  delayMicroseconds(500);
//  digitalWrite(SS, HIGH);
//  delayMicroseconds(500);
//  
//  delay(2000);
//  
//  digitalWrite(SS, LOW);
//  delayMicroseconds(500);
//  Serial.println(SPI.transfer(IR_TX_OFF));
//  delayMicroseconds(500);
//  Serial.println(SPI.transfer(0x00));
//  delayMicroseconds(500);
//  digitalWrite(SS, HIGH);
//  delayMicroseconds(500);
//  
  
  // TX Sending
  digitalWrite(SS,LOW);
  delayMicroseconds(100);
  Serial.println(SPI.transfer(01));
  delayMicroseconds(100);
  Serial.println(SPI.transfer(02));
  delayMicroseconds(100);
  Serial.println(SPI.transfer(0x00));
  delayMicroseconds(100);
  for (int i = 0; i < 2; i++) {
   Serial.println(SPI.transfer(0x00)); 
    
  }
  
  Serial.println(SPI.transfer(0x00));
  
  
//  for (int i = 0; i < tx_length; i++) {
//   expectedTop = (delays[i]>>8);
//   actualBottom = SPI.transfer(delays[i] >> 8); 
//   Serial.println(actualBottom, DEC);
//   delayMicroseconds(100);
//   if (i != 0 && expectedBottom != actualBottom) {
//     Serial.println("Incorrect Bottom Echo:");
//     Serial.print("Entire Number: ");
//     Serial.println(delays[i], DEC);
//     Serial.print("Expected: ");
//     Serial.print(expectedBottom, DEC);
//     Serial.print(", Actual: ");
//     Serial.print(actualBottom, DEC);
//     Serial.print(", Index: ");
//     Serial.println(i-1);
//
//   }
//   expectedBottom = delays[i];
//   actualTop = SPI.transfer(delays[i]); 
//   Serial.println(actualTop, DEC);
//   delayMicroseconds(100);
//   if (i != 0 && expectedTop != actualTop) {
//     Serial.println("Incorrect Top Echo:");
//     Serial.print("Entire Number: ");
//     Serial.println(delays[i], DEC);
//     Serial.print("Expected: ");
//     Serial.print(expectedTop, DEC);
//     Serial.print(", Actual: ");
//     Serial.print(actualTop, DEC);
//     Serial.print(", Index: ");
//     Serial.println(i);
//
//   }
//   
//  }
//  Serial.println(SPI.transfer(0x00));
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(0x16));
//  delayMicroseconds(100);
//  digitalWrite(SS,HIGH);
//  
//  // TX Reading
//  digitalWrite(SS,LOW);
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(TX_RD_CMD));
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(0x00));
//  delayMicroseconds(100);
//  for (int i = 0; i < tx_length; i++) {
//   Serial.println(SPI.transfer(0x00), DEC); 
//   delayMicroseconds(100);
//   Serial.println(SPI.transfer(0x00), DEC); 
//   delayMicroseconds(100);
//  }
//  Serial.println(SPI.transfer(0x00), DEC);
//  delayMicroseconds(100);
//  Serial.println(SPI.transfer(0x16), DEC);
//  digitalWrite(SS,HIGH);  
  
  delay(2500);
}
