#include <avr/io.h>
#include <avr/interrupt.h>
#include "spi_via_usi_driver.c"

#ifndef cbi
#define cbi(sfr, bit) (_SFR_BYTE(sfr) &= ~_BV(bit))
#endif
#ifndef sbi
#define sbi(sfr, bit) (_SFR_BYTE(sfr) |= _BV(bit))
#endif

#define IR_TX 0
#define MIC 1
#define CS	2
#define AMBIENT_LIGHT 7

#define BUF_SIZE 25
volatile char LIGHT_BUF[BUF_SIZE];
volatile char MIC_BUF[BUF_SIZE];
volatile int LIGHT_BUF_LOC=0;
volatile int MIC_BUF_LOC=0;
volatile int counter = 0;

void prepareADC(void);
int analogRead(char pin);
void delay(unsigned long ms);
void delayMicroseconds(unsigned long us);
void toggleIR(void);
void initializeBuffers(void);

int main(void) {

    cli();

    // Make the mic pin an input
    cbi(DDRA, MIC);

    // Make the ambient light as input
    cbi(DDRA, AMBIENT_LIGHT);

    // Make IR an output for testing
    sbi(DDRB, IR_TX);

    initializeBuffers();

    // interrupt on INT0 pin falling edge
    MCUCR = (1<<ISC01);

    // turn on external interrupts!
    GIMSK |= (1<<INT0);

    // Set CS as OUTPUT
    cbi(DDRB, CS);

    // Set up pull up
    sbi(PORTB, CS);

    // Start up slave 
    spiX_initslave(0);

    // disable spi counter overflow enable
    USICR&= ~(1<<USIOIE);
    USICR&= ~(1<<USIWM0);

    // Set up ADC
    prepareADC();

    // Set clock divider to 8 (1MHz)
    sbi(TCCR1B, CS11);

    // Set the counter to CTC (clear on match)
    sbi(TCCR1B, WGM12);

    // Set frequency to 10kHz
    // Not sure why 47 works better than 50
    // 8000000/8/50/2 should be 10kHz...
    OCR1A = 47;

    // Allow interrupts on comp a
    sbi(TIMSK1, OCIE1A);

    // Unleash the interrupts!
	sei();

	// Wait for SPI interrupts
	while(1);

    // We'll never *actually* return. FOOLED YOU COMPILER!
	return 0;
}

void initializeBuffers(void) {

    for (int i = 0; i < BUF_SIZE; i++) {
        MIC_BUF[i] = 0;
        LIGHT_BUF[i] = 0;
    }
}

ISR(TIM1_COMPA_vect) {
    // Add light data to buffer
    analogRead(AMBIENT_LIGHT);
    // char scaledReading = (char)rawLightReading/4;
    // LIGHT_BUF[LIGHT_BUF_LOC++] = analogRead(AMBIENT_LIGHT);

    // // Add mic data to buffer
    // MIC_BUF[MIC_BUF_LOC++] = analogRead(MIC);

    LIGHT_BUF[LIGHT_BUF_LOC++] = 30;

    if(LIGHT_BUF_LOC > BUF_SIZE){
        LIGHT_BUF_LOC=0;
    }

    // Add mic data to buffer
    MIC_BUF[MIC_BUF_LOC++] = 12;

    if(MIC_BUF_LOC > BUF_SIZE){
        MIC_BUF_LOC=0;
    }

    // toggleIR();
}

void prepareADC(void) {

    // Set up ADC clock prescalar to 64 (125kHz) by writing ADPS bits of ADSCRA
    sbi(ADCSRA, ADPS2);
    sbi(ADCSRA, ADPS1);
    cbi(ADCSRA, ADPS0);

    // Enable ADC by writing ADEN in ADSCRA
    sbi(ADCSRA, ADEN);

    // Set reference voltage to AREF by writing to the ADMUX register
    cbi(ADMUX, REFS1);
    sbi(ADMUX, REFS0);
}

int analogRead(char pin) {

    // Set the pin by writing to ADMUX 
    // There is probably a better way to do this
    (pin & 1) ? sbi(ADMUX, 0) : cbi(ADMUX, 0);
    (pin & 2) ? sbi(ADMUX, 1) : cbi(ADMUX, 1);
    (pin & 4) ? sbi(ADMUX, 2) : cbi(ADMUX, 2);

    // Start the conversion
    sbi(ADCSRA, ADSC);

    // Wait for the conversion to finish
    while((ADCSRA & (1<<ADSC)) != 0);

    // Return the 10 bit result
    return ADC;
}

void delay(unsigned long ms) {
  delayMicroseconds(1000 * ms);
}

void delayMicroseconds(unsigned long us) {
    // for the 8 MHz internal clock on the ATmega168

    // for a one- or two-microsecond delay, simply return.  the overhead of
    // the function calls takes more than two microseconds.  can't just
    // subtract two, since us is unsigned; we'd overflow.
    if (--us == 0)
    return;
    if (--us == 0)
    return;

    // the following loop takes half of a microsecond (4 cycles)
    // per iteration, so execute it twice for each microsecond of
    // delay requested.
    us <<= 1;

    // partially compensate for the time taken by the preceeding commands.
    // we can't subtract any more than this or we'd overflow w/ small delays.
    us--;

    // busy wait
    __asm__ __volatile__ (
    "1: sbiw %0,1" "\n\t" // 2 cycles
    "brne 1b" : "=w" (us) : "0" (us) // 2 cycles
    );
}

void toggleIR(void) {
    ((PINB & 0x01) ? cbi(PORTB, IR_TX) : sbi(PORTB, IR_TX));
}

ISR(INT0_vect, ISR_NOBLOCK){  //nested interrupts, aka stacks on stacks of interrupts.
    USICR|=(1<<USIOIE)|(1<<USIWM0); //re-enable USI

    cbi(TIMSK1, OCIE1A);

    spiX_put(0x35); //ACK
    spiX_wait();

    switch(spiX_get()){

    // Make sure comms are actually working
    case 0x00:     //ACK-ACK signal
        spiX_put(0x55);//ACK
        spiX_wait();
        break;
         
    // Read from the Mic Buffer
     case 0x01: //READ BUF
        for(counter=0;counter<BUF_SIZE;counter++){//read backwards through the buffer till you get to 0, then start at the buffer end
            spiX_put(MIC_BUF[MIC_BUF_LOC]);
            spiX_wait();
            MIC_BUF_LOC--;
            if(MIC_BUF_LOC<1){
                MIC_BUF_LOC=(BUF_SIZE-1);
            }
        }
        break;

    // Read from the Light Buffer
     case 0x02:
        for(counter=0;counter<BUF_SIZE;counter++){//read backwards through the buffer till you get to 0, then start at the buffer end
            spiX_put(LIGHT_BUF[LIGHT_BUF_LOC]);
            spiX_wait();
            LIGHT_BUF_LOC--;
            if(LIGHT_BUF_LOC<1){
                LIGHT_BUF_LOC=(BUF_SIZE-1);
            }
        }
        break;
  }
  // Re-enable ADC reading timer
  sbi(TIMSK1, OCIE1A);

  USICR&= ~(1<<USIOIE);  //disable USI
  USICR&= ~(1<<USIWM0);  //disable USI
}
