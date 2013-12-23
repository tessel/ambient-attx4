// #include </Users/Jon/Work/technical/beta/modules/ambient-attx4/firmware/arduino/ambient/spi_via_usi_driver.c>
#include <C:/Users/Eric/Documents/GitHub/beta/modules/ambient-attx4/firmware/arduino/ambient/spi_via_usi_driver.c>

#ifndef cbi
#define cbi(sfr, bit) (_SFR_BYTE(sfr) &= ~_BV(bit))
#endif
#ifndef sbi
#define sbi(sfr, bit) (_SFR_BYTE(sfr) |= _BV(bit))
#endif

// Port A, pin 1
#define LOUDNESS_PIN 1

// Port B, pin 2
#define CS_PIN  2

// Port A, pin 7
#define PHOTODIODE_PIN 3

// Port A, pin 2
#define MIC_PIN 2 

// Port B Pin 1
#define TRIG_INT 1

// Available commands
#define ACK_CMD  0
#define LIGHT_CMD 1
#define SOUND_CMD  2
#define LOUDNESS_CMD 3
#define LIGHT_TRIGGER_CMD 4
#define LOUDNESS_TRIGGER_CMD 5
#define TRIGGER_FETCH_CMD 6

// Response constants
#define ALIVE_CODE 0x55
#define ACK_CODE 0x33
#define STOP_CMD 0x16

// Size of buffers (be careful about making this bigger, could run out of bss)
#define BUF_SIZE 32

// Iterater
volatile int counter = 0;

// Light trigger to be hit
volatile char lightTrigger = 0x00;
// Value read on trigger hit
volatile char lightTriggerReadVal = 0x00;

// Loudness trigger to be hit
volatile char loudnessTrigger = 0x00;
// Value read on trigger hit
volatile char loudnessTriggerReadVal = 0x00;


// The type for the buffer
typedef struct 
{
  volatile char buffer[BUF_SIZE]; 
  volatile int bufferLocation;
} DataBuffer;


// A buffer and buffer indexer for each source
volatile DataBuffer LightBuffer;
DataBuffer MicBuffer;
DataBuffer LoudnessBuffer;

// Our array of data buffers
volatile DataBuffer *Buffers[] = {&LightBuffer, &MicBuffer,  &LoudnessBuffer};


void setup() {
  cli();

  LightBuffer.bufferLocation = 0;
  LoudnessBuffer.bufferLocation = 0;
  MicBuffer.bufferLocation = 0;

  // Make the mic pin an input
  cbi(DDRA, MIC_PIN);

  // Make the ambient light as input
  cbi(DDRA, PHOTODIODE_PIN);
  
  // Make the Interrupt pin an output
  sbi(DDRB, TRIG_INT);
  
  // Pull it low
  cbi(PORTB, TRIG_INT);

  // interrupt on INT0 pin low edge
  sbi(MCUCR, ISC01);

  // turn on interrupts!
  sbi(GIMSK, INT0);

  // Set CS as OUTPUT
  cbi(DDRB, CS_PIN);

  // Set up pull up
  sbi(PORTB, CS_PIN);

  // Start up slave 
  spiX_initslave(0);

  // disable spi counter overflow enable
  USICR&= ~(1<<USIOIE);
  USICR&= ~(1<<USIWM0);

  // Set clock divider to 8 (1MHz)
  sbi(TCCR1B, CS11);

  // Set the counter to CTC (clear on match)
  sbi(TCCR1B, WGM12);

  // Set frequency to 5kHz
  // (8000000/8/200) Hz
  OCR1A = 200;

  // Allow interrupts on comp a
  sbi(TIMSK1, OCIE1A);

  // Unleash the interrupts!
  sei();
}

void loop() {}

ISR(TIM1_COMPA_vect) {
  
  // Only take the lowest 8 bits
  LightBuffer.buffer[LightBuffer.bufferLocation++] = analogRead(PHOTODIODE_PIN);

  // If a light trigger has been set and the level is hit 
  if (lightTrigger != 0 && LightBuffer.buffer[LightBuffer.bufferLocation - 1] >= lightTrigger) {
    
    // Set the read value
    lightTriggerReadVal = LightBuffer.buffer[LightBuffer.bufferLocation - 1];
    
    // Raise the interrupt pin
    sbi(PORTB, TRIG_INT);
    
    // Then put it back down
    cbi(PORTB, TRIG_INT);
  }
  
  if (LightBuffer.bufferLocation == BUF_SIZE) {
    LightBuffer.bufferLocation = 0;
  }

  //Change order of ADC result in ADCL and ADCH
  sbi(ADCSRB, ADLAR);
  
  // Add mic data to buffer
  analogRead(MIC_PIN);
  
  MicBuffer.buffer[MicBuffer.bufferLocation++] = ADCH;
  

  if (MicBuffer.bufferLocation == BUF_SIZE) {
    MicBuffer.bufferLocation = 0;
  }
  
  analogRead(LOUDNESS_PIN);
//   // Get eight upper bits of loudness
  LoudnessBuffer.buffer[LoudnessBuffer.bufferLocation++] = ADCH;
  
    // If a loudness trigger has been set and the level is hit 
  if (loudnessTrigger != 0 && LoudnessBuffer.buffer[LoudnessBuffer.bufferLocation - 1] >= loudnessTrigger) {
    
    // Set the read value
    loudnessTriggerReadVal = LoudnessBuffer.buffer[LoudnessBuffer.bufferLocation - 1];
    
    // Raise the interrupt pin
    sbi(PORTB, TRIG_INT);
    
    // Then put it back down
    cbi(PORTB, TRIG_INT);
  }

  if (LoudnessBuffer.bufferLocation == BUF_SIZE) {
    LoudnessBuffer.bufferLocation = 0;
  }
 
 // Reverse change of ADCL/H bit order
  cbi(ADCSRB, ADLAR);
}

ISR(INT0_vect){
  
  // Disable ADC timer for now
  cbi(TIMSK1, OCIE1A);
  
  // Enable interrupts (SPI needs this)
  sei();

  //re-enable USI
  USICR|=(1<<USIOIE)|(1<<USIWM0); 

  // put 'alive' bit 
  spiX_put(ALIVE_CODE); 
  spiX_wait();
  
  // Grab the command
  char command = spiX_get();
  
  // Initialize variables
  char length = 0;
  volatile DataBuffer *dataBuffer;
  
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

  // Routine for reading buffers
   case LIGHT_CMD: 
   case SOUND_CMD:
   case LOUDNESS_CMD:
   
   // Grab requested buffer
   dataBuffer = Buffers[command - 1]; 
   // Grab read length
   length = spiX_get(); 
   
   // Echo read length
   spiX_put(length); 
   // Wait for echo to complete
   spiX_wait();
   
   // Iterate through buffer
   for(counter=0;counter<length;counter++){ 
     
     // Put the byte at the current location in the buffer
     spiX_put(dataBuffer->buffer[dataBuffer->bufferLocation]);
     
     // Wait for it to be sent
     spiX_wait();
     
     // Decrement buffer (we read going backwards)
     dataBuffer->bufferLocation--;
     
     // If the buffer is at 0
     if (dataBuffer->bufferLocation < 0) {
       
       // Set it to the end of the buffer
       dataBuffer->bufferLocation = (BUF_SIZE-1); 
     }
    }
    
    // Put the stop command
    spiX_put(STOP_CMD);
    
    // Wait for it to be sent
    spiX_wait();
    break;
    
   case LIGHT_TRIGGER_CMD:
     lightTrigger = spiX_get();
     spiX_put(lightTrigger);
     spiX_wait();
     break;
     
   case LOUDNESS_TRIGGER_CMD:
     loudnessTrigger = spiX_get();
     spiX_put(loudnessTrigger);
     spiX_wait();
     break;
     
   case TRIGGER_FETCH_CMD:
     // Put Light Trigger Val
     spiX_put(lightTriggerReadVal);
     
     // Wait for it to go through
     spiX_wait();
     
     // Clear it
     lightTriggerReadVal = 0;
     
     // Put Loudnesss Trigger Val
     spiX_put(loudnessTriggerReadVal);
    
      // Wait for it to be sent
     spiX_wait(); 
     
     // Clear it
     loudnessTriggerReadVal = 0;
     
     break;
 }
  
  // Disable USI
  USICR&= ~(1<<USIOIE);
  USICR&= ~(1<<USIWM0);
  
  // Re-enable ADC reads
  sbi(TIMSK1, OCIE1A);
}



