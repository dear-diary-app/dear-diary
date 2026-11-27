package com.deardiary.privateapp;
import android.net.Uri;import org.junit.Test;import static org.junit.Assert.*;
@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner.class)@org.robolectric.annotation.Config(sdk=28,manifest=org.robolectric.annotation.Config.NONE)
public class InstagramHostsTest{
 @Test public void onlyHttpsExactLoginHosts(){for(String h:new String[]{"instagram.com","www.instagram.com","m.instagram.com","i.instagram.com","facebook.com","www.facebook.com","m.facebook.com","accountscenter.instagram.com"})assertTrue(InstagramActivity.allowed(Uri.parse("https://"+h+"/accounts/login/?next=%2Freels%2F")));}
 @Test public void lookalikesSchemesPortsRejected(){for(String u:new String[]{"http://www.instagram.com/","https://instagram.com.attacker.invalid/","https://evilinstagram.com/","https://www.instagram.com:444/","https://evil@www.instagram.com/","file:///secret","content://diary/secret","intent://instagram.com/","javascript:alert(1)","https://dear-diary-app.github.io/dear-diary/"})assertFalse(InstagramActivity.allowed(Uri.parse(u)));}
}
