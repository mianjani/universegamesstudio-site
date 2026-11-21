# UGS Website Files

Company: UNIVERSE GAMES STUDIO(UGS) (SMC-PRIVATE) LIMITED
Website: https://universegamesstudio.com/
Brand accent: Orange #FF7A00

## Upload to GitHub Pages
Upload the contents of this folder into the ROOT of the existing website repository, preserving the folder structure. Do not upload the outer `ugs-website` folder itself as a nested directory.

Included pages:
- `/` — homepage (`index.html`)
- `/about-us/`
- `/privacy-policy/`
- `/terms-and-conditions/`
- `/contact-us/`
- `/cookie-policy/`
- `/content-takedown/`
- `/faq/`
- `/404.html`
- `/style.css`
- `/assets/ugs-logo.jpeg`

## IMPORTANT: preserve app-ads.txt and CNAME
This package intentionally does NOT contain a replacement `app-ads.txt` or `CNAME`.
Keep your current verified `app-ads.txt` file in the repository ROOT, exactly as it is, and keep the existing `CNAME` file unchanged. Do not create an empty app-ads.txt and do not replace seller IDs with guessed values.

For ad crawlers, the file must remain publicly accessible at:
https://universegamesstudio.com/app-ads.txt

After deployment, open that exact URL in a private/incognito browser window. It should show the actual seller records as plain text, not a 404 page or HTML website. Also verify:
- https://universegamesstudio.com/privacy-policy/
- https://universegamesstudio.com/terms-and-conditions/
- https://universegamesstudio.com/contact-us/

## Before publishing the Privacy Policy
The policy names Unity Ads, AppLovin MAX, Google AdMob and Mintegral as services that may be used depending on the game/version. Confirm that each named SDK is actually present in at least one released UGS game, and remove any provider that is not used. Also confirm actual permissions, analytics, purchase flows, age ratings and data practices for each game. Do not claim a data practice or SDK that is not actually implemented.

The legal pages are a practical website draft based on the information supplied by UGS, not legal advice. Have the final wording checked against the company's actual operations and applicable law before relying on it for legal compliance.
