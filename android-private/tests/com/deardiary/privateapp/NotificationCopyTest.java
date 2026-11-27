package com.deardiary.privateapp;
import org.junit.*;import static org.junit.Assert.*;
public class NotificationCopyTest{
 @Test public void everyKnownEventHasSpecificCopy(){java.util.Set<String> bodies=new java.util.HashSet<>();for(String type:new String[]{"chat","friend_free","scheduled_sent","feed","open","writing","lock","published","ask"})bodies.add(NotificationCopy.body(type));assertEquals(9,bodies.size());}
 @Test public void writingReminderIsClear(){assertTrue(NotificationCopy.body("writing").contains("9 PM writing reminder"));assertTrue(NotificationCopy.body("writing").contains("10 PM IST"));}
 @Test public void freeIsNotOnline(){assertEquals("Your friend is free now.",NotificationCopy.body("friend_free"));assertFalse(NotificationCopy.body("friend_free").contains("online"));}
 @Test public void unknownOrNullDoesNotReflectPayload(){assertEquals(NotificationCopy.body(null),NotificationCopy.body("Aruba private diary contents"));assertFalse(NotificationCopy.body("Aruba private diary contents").contains("Aruba"));}
 @Test public void categoryIdsAreDistinct(){assertNotEquals(NotificationCopy.id("chat"),NotificationCopy.id("writing"));assertTrue(NotificationCopy.chat("friend_free"));assertFalse(NotificationCopy.chat("writing"));}
}
