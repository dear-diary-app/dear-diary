package com.deardiary.privateapp;
// Picker-specific elapsed-time window, never an authentication grant.
final class PickerPrivacy {
 static final long GRACE_MS=60000;
 private long until=0;
 void start(long now){until=now+GRACE_MS;}
 boolean grace(long now){return until>0&&now<until;}
 boolean expired(long now){return until>0&&now>=until;}
 void finish(){until=0;}
}
