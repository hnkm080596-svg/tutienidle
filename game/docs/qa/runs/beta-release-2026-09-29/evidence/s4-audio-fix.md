# F-ENV-AUDIO-CRLF repair

`combatActionSrc.match(...\n\n)` returned null on CRLF checkouts because the
authoritative source uses \r\n\r\n line endings. The oracle - not the product
- was environment-fragile. Regex now tolerates both endings; suite is fully
green for the first time on this checkout.
