package com.deardiary.privateapp;
import org.junit.*;import static org.junit.Assert.*;
public class InstagramReturnTicketTest{
 @Test public void sameSessionOnce(){InstagramReturnTicket t=new InstagramReturnTicket();t.issue("a",10);assertTrue(t.consume("a",11,true));assertFalse(t.consume("a",12,true));}
 @Test public void expiresAtTenMinutes(){InstagramReturnTicket t=new InstagramReturnTicket();t.issue("a",10);assertFalse(t.consume("a",600010,true));}
 @Test public void wrongSessionCannotConsume(){InstagramReturnTicket t=new InstagramReturnTicket();t.issue("a",10);assertFalse(t.consume("b",11,true));assertFalse(t.consume("a",12,true));}
 @Test public void unsafeReturnFails(){InstagramReturnTicket t=new InstagramReturnTicket();t.issue("a",10);assertFalse(t.consume("a",11,false));}
 @Test public void clearAndRecreationFail(){InstagramReturnTicket t=new InstagramReturnTicket();t.issue("a",10);t.clear();assertFalse(t.consume("a",11,true));assertFalse(new InstagramReturnTicket().consume("a",11,true));}
 @Test public void invalidClockFails(){InstagramReturnTicket t=new InstagramReturnTicket();t.issue("a",10);assertFalse(t.consume("a",9,true));}
}
