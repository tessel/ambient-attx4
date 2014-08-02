// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

#include "../include/ambient-attx4.h"

// Iterater
volatile int counter = 0;

// Light trigger to be hit
volatile uint16_t lightTrigger = 0x00;
// Value read on trigger hit
volatile uint16_t lightTriggerReadVal = 0x00;

// Loudness trigger to be hit
volatile uint16_t soundTrigger = 0x00;
// Value read on trigger hit
volatile uint16_t soundTriggerReadVal = 0x00;

// Program Flash Checksum
volatile unsigned short checksum = 0xffff;

// A buffer and buffer indexer for each source
volatile DataBuffer LightBuffer;
volatile DataBuffer SoundBuffer;

void setup(void);
void setupIO(void);
void enableSPI(void);
void setupTimer(void);
void prepareADC(void);
uint16_t analogRead(char pin);
volatile DataBuffer bufferForCommand(uint8_t command);


extern void _exit();

int main(void) {
  checksum = calculate_checksum( (unsigned short) _exit << 1 );

  setup();

  while (1){};

  return 0;

}

void setup(void) {

  // Turn off interrupts
  cli();

  // Reset buffer locations
  LightBuffer.bufferLocation = 0;
  SoundBuffer.bufferLocation = 0;

  setupIO();

  prepareADC();

  enableSPI();

  setupTimer();

  // Unleash the interrupts!
  sei();

}

void setupIO(void) {
  // Make the "decibel" pin an input
  cbi(DDRA, SOUND_PIN);

  // Make the ambient light as input
  cbi(DDRA, LIGHT_PIN);

  // Make the Interrupt pin an output
  sbi(DDRB, IRQ_PIN);

  // Pull it low
  cbi(PORTB, IRQ_PIN);

  // Set MOSI as an input
  cbi(DDRA, MOSI);
}

void enableSPI(void) {
  // configure: interrupt on INT0 pin falling edge
  MCUCR = (1<<ISC01);

  // enable interrupt
  sbi(GIMSK, INT0);

  // Set CS as INPUT
  cbi(DDRB, CS_PIN);

  // Set up pull up to keep CS high
  sbi(PORTB, CS_PIN);

  // disable spi counter overflow enable
  USICR&= ~(1<<USIOIE);
  USICR&= ~(1<<USIWM0);
}

void setupTimer(void) {
  // Set clock divider to 8 (1MHz)
  sbi(TCCR1B, CS11);

  // Set the counter to CTC (clear on match)
  sbi(TCCR1B, WGM12);

  // Set frequency to 5kHz
  // (8000000/8/200) Hz
  OCR1A = 200;

  // Allow interrupts on comp a
  sbi(TIMSK1, OCIE1A);
}

void prepareADC(void) {

  // Make sure the power reduction register isn't set
  cbi(PRR, PRADC);

  // Enable ADC by writing ADEN in ADSCRA
  sbi(ADCSRA, ADEN);

  // Set up ADC clock prescalar to 64 (125kHz) by writing ADPS bits of ADSCRA
  ADCSRA |= 6;

  // Set reference voltage to AREF by writing to the ADMUX register
  ADMUX = 0;
  cbi(ADMUX, REFS1);
  sbi(ADMUX, REFS0);
}

uint16_t analogRead(char pin) {

  uint16_t value;

  // Clear lowest five bits
  ADMUX &= 0b11100000;

  // Set five bits with pin
  ADMUX |= (pin & 0b00011111);

  // Start the conversion
  sbi(ADCSRA, ADSC);

  // Wait for the conversion to finish
  while((ADCSRA & (1<<ADSC)) != 0);

  value = ADCL;

  value += (ADCH << 8);

  // Return the 10 bit result
  return value;
}

volatile DataBuffer bufferForCommand(uint8_t command) {

  if (command == LIGHT_CMD)
  {
    return LightBuffer;
  }
  else
  {
    return SoundBuffer;
  }
}

volatile uint16_t *triggerValueForCommand(uint8_t command) {
  if (command == LIGHT_TRIGGER_CMD) {
    return &lightTrigger;
  }
  else {
    return &soundTrigger;
  }
}

ISR(TIM1_COMPA_vect) {

  LightBuffer.buffer[LightBuffer.bufferLocation++] = analogRead(LIGHT_PIN);

  // If a light trigger has been set and the level is hit
  if (lightTrigger != 0 && LightBuffer.buffer[LightBuffer.bufferLocation - 1] >= lightTrigger) {

    // Set the read value
    lightTriggerReadVal = LightBuffer.buffer[LightBuffer.bufferLocation - 1];

    // Raise the interrupt pin
    sbi(PORTB, IRQ_PIN);

  }

  if (LightBuffer.bufferLocation == BUF_SIZE) {
    LightBuffer.bufferLocation = 0;
  }

  SoundBuffer.buffer[SoundBuffer.bufferLocation++] = analogRead(SOUND_PIN);

    // If a loudness trigger has been set and the level is hit
  if (soundTrigger != 0 && SoundBuffer.buffer[SoundBuffer.bufferLocation - 1] >= soundTrigger) {

    // Set the read value
    soundTriggerReadVal = SoundBuffer.buffer[SoundBuffer.bufferLocation - 1];

    // Raise the interrupt pin
    sbi(PORTB, IRQ_PIN);
  }

  if (SoundBuffer.bufferLocation == BUF_SIZE) {
    SoundBuffer.bufferLocation = 0;
  }
}

ISR(INT0_vect){

  // Disable ADC timer for now
  cbi(TIMSK1, OCIE1A);

  // Start up slave
  spiX_initslave(0);

  // Enable interrupts (SPI needs this)
  sei();

  //re-enable USI
  USICR|=(1<<USIOIE)|(1<<USIWM0);

  // put 'alive' bit
  spiX_put(ALIVE_CODE);
  spiX_wait();

  // Grab the command
  char command = spiX_get();
  uint16_t value = -1;

  // Initialize variables
  volatile char length = 0;
  DataBuffer dataBuffer;
  volatile uint16_t trigVal = 0;

   // Confirm command
  spiX_put(command);

  // Wait for it to be sent
  spiX_wait();

  // Switch based on the command
  switch(command){

   // ACK command checks comms
    case ACK_CMD:

      //Send ACK code
      spiX_put(ACK_CODE);

      // Wait for it to be sent
      spiX_wait();
      break;

    // If the checksum is asked for
    case CRC_CMD:
      spiX_put((checksum >> 8) & 0xff);
      spiX_wait();
      spiX_put((checksum >> 0) & 0xff);
      spiX_wait();
      break;

    // If they want firmware version
    case FIRMWARE_CMD:
      // Send the firmware version
      spiX_put(read_firmware_version());
      spiX_wait();
      break;
    // If they want firmware version
    case MODULE_ID_CMD:
      // Send the firmware version
      spiX_put(read_module_id());
      spiX_wait();
      break;

    // Routine for reading buffers
    case LIGHT_CMD:
    case SOUND_CMD:

      // Grab requested buffer
      dataBuffer = bufferForCommand(command);
      // Grab read length
      length = spiX_get();

      // Echo read length
      spiX_put(length);
      // Wait for echo to complete
      spiX_wait();

      // Iterate through buffer
      // Potential Bug: Could read at one index past the last recorded value. may need to decrement before putting
      for(counter=0;counter<length;counter++){

         // If the buffer is at 0
         if (dataBuffer.bufferLocation == 0) {

           // Set it to the end of the buffer
           dataBuffer.bufferLocation = (BUF_SIZE-1);
         }

        // Decrement buffer (we read going backwards)
        dataBuffer.bufferLocation--;

        value = dataBuffer.buffer[dataBuffer.bufferLocation];

        // Put the byte at the current location in the buffer
        spiX_put(value >> 8);

        // Wait for it to be sent
        spiX_wait();

        spiX_put(value & 0xFF);
        spiX_wait();
      }


      // Put the stop command
      spiX_put(STOP_CMD);

      // Wait for it to be sent
      spiX_wait();

      break;

    case LIGHT_TRIGGER_CMD:
    case SOUND_TRIGGER_CMD:

      // Gather high 8 bits
      trigVal = (spiX_get() << 8);
      // Echo
      spiX_put(trigVal >> 8);
      spiX_wait();

      // Gather low 8 bits
      trigVal |= (spiX_get());
      //Echo
      spiX_put(trigVal & 0xFF);
      spiX_wait();

      *(triggerValueForCommand(command)) = trigVal;
      break;

   case TRIGGER_FETCH_CMD:
      // Put Light Trigger Val
      spiX_put(lightTriggerReadVal >> 8);

      // Wait for it to go through
      spiX_wait();

      spiX_put(lightTriggerReadVal & 0xFF);

      // Wait for it to go through
      spiX_wait();

      // Clear it
      lightTriggerReadVal = 0;

      // Put Loudnesss Trigger Val
      spiX_put(soundTriggerReadVal >> 8);

      // Wait for it to be sent
      spiX_wait();

        // Put Loudnesss Trigger Val
      spiX_put(soundTriggerReadVal & 0xFF);

      // Wait for it to go through
      spiX_wait();

      // Clear it
      soundTriggerReadVal = 0;

      // Clear IRQ
      cbi(PORTB, IRQ_PIN);

      break;
 }

  // Disable USI
  USICR&= ~(1<<USIOIE);
  USICR&= ~(1<<USIWM0);

  cbi(DDRA, MOSI);
  cbi(DDRA, MISO);

  // Re-enable ADC reads
  sbi(TIMSK1, OCIE1A);
}
