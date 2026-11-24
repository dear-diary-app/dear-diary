# Chat bottom edge

The composer previously added a translucent control gradient, while the HTML/body canvas and browser theme-colour hint used the top of the page gradient. This could produce two different bands beneath the message box.

The chat gradient now reaches its theme bottom colour before the composer. The composer and safe-area padding use that same colour. HTML/body, the startup colour cache and the runtime theme-colour hint use the bottom colour too. Weather artwork fades before the composer edge rather than painting a second bottom colour.

The static manifest uses Warm paper's bottom colour for installation/launch. Runtime colours follow the active theme. A previously installed app may retain its old launch colour until its manifest is refreshed by the browser.

Synthetic checks: paper and midnight, 390/820px widths, zero and simulated 34px bottom safe-area, reduced keyboard-sized viewport. Checked equal computed canvas/composer colours and no horizontal overflow, then visually inspected screenshots. This does not simulate a physical OS gesture bar or an actual keyboard.

Browser/OS system bars are outside the DOM. Theme-colour and colour-scheme are hints; a phone can apply its own contrast treatment, ignore a hint, or cache PWA launch colours. Physical-phone and installed-PWA system-bar appearance remain unverified.
