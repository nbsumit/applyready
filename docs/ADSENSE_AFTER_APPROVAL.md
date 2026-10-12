# After AdSense approves ApplyReady

Do these steps in order once you receive the approval email. Nothing here needs a developer: it is one command, a few settings in your AdSense account and a quick check. Expect to spend about an hour.

Your publisher id is already on every page (`ca-pub-2713609207324356`) and in `ads.txt`. Ads stay off until you complete step 3, so approval alone shows nothing.

## 1. Check that the account is ready

1. Sign in to AdSense and open **Sites**. `applyready.in` should show **Ready** (not "Needs attention").
2. Open **Payments** and finish the profile: name and address as they appear on your bank account, and the payment method. Google sends a PIN by post once you reach the payment threshold, so keep the address correct.
3. Open **Account > Settings > Account information** and make sure the site URL is `https://applyready.in`.
4. Open **Sites > applyready.in > ads.txt**. It should say **Authorized**. If it says "Not found", open `https://applyready.in/ads.txt` in a browser. It must show one line starting with `google.com, pub-2713609207324356, DIRECT`. It can take up to a day to turn green.

## 2. Turn on the consent message (required for visitors in Europe and the UK)

1. Go to **Privacy & messaging**.
2. Under **GDPR**, create a message with Google's consent management platform and select `applyready.in`. Use the default design. Publish it.
3. Do the same under **US states regulations** if you want to offer the "Do not sell or share my personal information" choice.
4. Under **Privacy & messaging > Your messages**, confirm both show **Published**.

Without step 2, Google limits or stops serving ads to visitors in the EEA and the UK. The privacy policy already describes this (section 3 of `privacy.html`), so no page text needs to change.

## 3. Create ad units and switch the slots on

Every guide, exam page, KB page and tool landing page already has one reserved, hidden slot placed between content sections. They are the only places ads will appear.

1. In AdSense open **Ads > By ad unit > Display ads**.
2. Create **two** units, both type **Display ads** with **Responsive** size:
   - `ApplyReady Guides`, for the guides.
   - `ApplyReady Tools`, for the exam pages, KB pages and tool pages.
3. Copy the unit id from each snippet. It is the number in `data-ad-slot="..."`, ten digits long.
4. In a terminal in the project folder run:

   ```bash
   node scripts/enable-ads.js --guide-slot 1111111111 --tool-slot 2222222222
   ```

   (Use your own ids. To use one unit everywhere, run `node scripts/enable-ads.js --slot 1111111111`.)
5. Check what changed: `node scripts/enable-ads.js --check` prints how many slots are live. Expect 46.
6. Run the tests: `npm test`. They check that every live unit has a real id, that no page has more than two slots, and that nothing sits inside a tool or on the resume builder, 404 or offline pages.
7. Commit and push to `main`. GitHub Pages deploys in a minute or two.

To undo at any time: `node scripts/enable-ads.js --off`, then commit and push.

## 4. Check it works on the live site

1. Open `https://applyready.in/guides/ats-friendly-resume-guide.html` in a normal browser window. Ads can take a few minutes to appear after the first deploy, and a new unit can show blank for up to an hour. This is normal.
2. Look for the small "Advertisement" label above each ad and make sure the ad does not sit next to a button.
3. Open the same page on a phone. The ad should fit the width with no sideways scrolling.
4. Open the resume builder, the 404 page and the offline page. They must show no ads.
5. In your browser, open the developer tools console. There should be no red errors that mention `adsbygoogle`.
6. Never click your own ads. Use **Ad review center** or the AdSense preview if you want to see what is served.

## 5. Keep the account healthy

- **Do not** ask anyone to click ads, add text such as "support us by clicking", or place ads next to the Download and Process buttons. These are the most common reasons accounts are limited. `tests/content_tests.js` guards against the first two.
- **Do not** add more than two ad slots to a page, or ads to pages that have little text.
- Check **Policy center** in AdSense every week for the first month, then monthly.
- Keep the guides current. Update the "Last reviewed" line and the exam "Last verified" month whenever you re-check a figure against the official notice.
- If you move the site, change the domain or add a new page type, update `ads.txt`, the sitemap and the privacy policy together.
- Update `privacy.html` if you add any new third-party service (analytics, comments, embeds).

## 6. Optional improvements for later

- **Auto ads:** leave them off. The reserved slots keep ads away from the tools. If you ever turn them on, exclude the tool pages in **Ads > By site > Edit > Page exclusions**.
- **A second ad per long guide:** the guides are long enough for a second slot after the middle section. Add another reserved slot block, run `scripts/enable-ads.js`, and keep within two slots per page.
- **Analytics:** if you add Google Analytics or similar, update section 4 of `privacy.html` first. Today the policy states that none is used.
- **Domain email:** an address such as `contact@applyready.in` looks more established than a personal-domain address. Update `contact.html`, `about.html`, `privacy.html` and `terms.html` together.
- **Search Console:** submit `https://applyready.in/sitemap.xml` and check **Page indexing** monthly. More organic visits help earnings more than any ad setting.

## If you are not approved yet

A rejection email names the reason. The usual ones and the fix:

| Reason shown | What to do |
|---|---|
| Low value content / Thin content | Add original, experience-based detail to the guides you know best (screenshots, real examples, portal steps). Wait a few weeks and reapply. |
| Site under construction / Navigation | Check that every link works and every page is reachable from the header or footer (the test suite does this). |
| Policy violation: missing privacy policy | `privacy.html` exists and is linked from every footer. Make sure the AdSense review was run on `https://applyready.in`, not the `github.io` address. |
| Not enough traffic or a very new site | Keep publishing and sharing. Reapply after a few weeks of steady visits. |
| Ads.txt or site ownership | Confirm `https://applyready.in/ads.txt` opens and the `google-adsense-account` meta tag is in the page source. |

You can reapply as many times as you need. Each rejection shows the exact reason in the account.
