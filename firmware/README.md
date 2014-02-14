
Setting the 8MHz fuse bit:
```
avrdude -p attiny44 -P /dev/tty.usbmodem1421 -c avrisp -U lfuse:w:0xe2:m -u -b 19200
```

Programming:
```
make all; avrdude -p attiny44 -P /dev/cu.usbmodem1421 -c avrisp -b 19200 -U flash:w:ambient-attx4.hex;
```


