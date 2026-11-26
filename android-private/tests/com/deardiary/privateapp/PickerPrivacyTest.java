package com.deardiary.privateapp;
import org.junit.Test;
import static org.junit.Assert.*;
public class PickerPrivacyTest {
 @Test public void freshWindow(){PickerPrivacy p=new PickerPrivacy();p.start(100);assertTrue(p.grace(100));assertTrue(p.grace(60099));assertFalse(p.grace(60100));assertTrue(p.expired(60100));}
 @Test public void cancellationEndsWindow(){PickerPrivacy p=new PickerPrivacy();p.start(100);p.finish();assertFalse(p.grace(101));assertFalse(p.expired(999999));}
 @Test public void screenOffEndsGrace(){PickerPrivacy p=new PickerPrivacy();p.start(100);p.finish();assertFalse(p.grace(200));}
 @Test public void newRequestGetsOwnWindow(){PickerPrivacy p=new PickerPrivacy();p.start(100);p.finish();p.start(100000);assertTrue(p.grace(100001));assertFalse(p.expired(100001));}
}
