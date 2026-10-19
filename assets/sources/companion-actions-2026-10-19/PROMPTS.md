# Seasonal action generation prompts

The built-in image generation tool produced the accepted action originals. No external API key or fallback model was used. Rejected candidates remain outside production. Sources were reviewed for identity, seasonal clothes, intact tools, clean alpha and body continuity before deterministic packing.

## Fixed-outfit atlas prompt

Use case: stylized-concept. Create a production sprite animation atlas for the cozy PlayPets desktop game, ONE CHARACTER IN ONE FIXED OUTFIT. Crisp painted colored forms, warm fine outlines, matte shading, keep approved character design precisely. Reference image has three outfits but use ONLY the outfit explicitly specified below; NEVER mix seasons. Exact landscape grid: SIX equally spaced columns by FOUR rows =24 isolated full-body poses. Absolutely transparent RGBA gutters/background, no shadows or color haze. No text/labels/numbers, no ground patches, dirt, sparkles, effects, frames, backdrop. Clean alpha. Stable fixed three-quarter camera facing right in everyframe, all whole body plus all tools fullyinside cell. Generous transparent margins. Head/body scale identical across allposes; feet stay at common ground and never slide, torso/knees/arms genuinely bend. Hands/paws properly attached, fingers not floating, tools consistentlygripped. Do not make neutral duplicates in place of actionposes.
ROW1 (six poses) DIG with ONE short wood-handled metal spade in both hands: ready; knees bend/raise tool; blade meets ground lower right; crouch press and lever; lift and tip blade; lower tool/rise ready. Runtime supplies soil, no drawn ground. ROW2 (six poses) PLANT: ready holding tiny2leaf seedling; knees bend/reach; squat place seedling lower right; press gently with both hands; release emptyhands/rise; standing satisfied. Runtime supplies actual planteditem, no pot. ROW3 (six poses) FISH with ONE short woodrod and tinyreel: liftrodanticipation; extendrod castforward; patienthold rod angled upperright; samepatienthold briefblink; bracedknees/crankreel lowerhand; easetorightrecoverholdingrod. No fishingline, float, fish, water or decorations. Keep rod tip insidecell. ROW4 (six poses) DISCOVERY with emptyhands: relaxed; lookdowncurious; small surprised Omouth and openhands; delighted smile handsnearcheeks littleknee lift butfeetgrounded; proudpleased handswaist; neutralsettle. Keep tails/accessories consistent, no horizontaltravel.

## Outfit locks

### daisy-base

Daisy is the exact chestnut bob-haired girl explorer in reference LEFT figure. BASE OUTFIT ONLY: sage beret with white daisy yellow center, ivory long sleeve blouse, apricot dungaree dress, brown boots, small original olive leaf satchel. Young/compactlargehead friendly face, warm browneyes, subtlefreckles. NO scarf or coat. Gentle careful explorer deliberateweight.

### daisy-summer

Daisy is the exact chestnut bob-haired girl explorer in reference CENTER figure. SUMMER OUTFIT ONLY: sage beret with white daisy yellowcenter, ivory SHORT SLEEVE blouse, light apricot linen dungaree dress, lightbrownshoes, small original olive leafsatchel. Bare lowerlegs. Youngcompactlargehead friendlyfacewarmbrown eyes subtlefreckles. NO scarf, coat, trousers, leggings. Gentlecuriouscarefulactions.

### daisy-winter

Daisy is the exact chestnut bob-haired girl explorer in reference RIGHT figure. WINTER OUTFIT ONLY: sageberet with white daisy yellowcenter, rust-apricot woolcoat/dresshem, sageknittedscarf, OPAQUE BROWN LEGGINGS covering bothlegs above brownwinterboots, originaloliveleafsatchel. Sameyoungcompactbody warmbrowneyes chestnutbob. No barelegs. Gentlecuriouscarefulactions.

### pip-base

Pip is exact upright caramel floppy-eared puppy in reference LEFT figure, ivorymuzzle, warmdarkeyes, fluffytail, furrybarepaws. BASE ONLY washed medium-indigo denim chorejacket smallroundedcollar ivorytopstitch cream buttons over ivorytee, ivory CUFFED SHORTS and furrybarepaws. Whitefivepetal yellowcenterdaisy anatomicalLEFTchest. Neverhat/scarf/bag/overalls. Cheerfuleagerweight/soft earfollowthrough, keepgrounded.

### pip-summer

Pip exact upright caramel floppy-eared puppy in reference CENTER figure, ivorymuzzle warmdarkeyes fluffytail furrybarepaws. SUMMER ONLY short-sleeve lightweight INDIGO denim CAMP-COLLAR shirt over ivorytee, ivory CUFFED SHORTS, exposed furrybarepaws. AllframesSHORTS nevertrousers. Whitefivepetal yellowcenterdaisy anatomicalLEFTchest. NEVER shearling, wintercollar, hat, scarf, bag,overalls. Cheerfulgentlegrounded earfollowthrough.

### pip-winter

Pip exact upright caramelfloppy-eared puppy in reference RIGHT figure ivorymuzzle warmdarkeyes fluffytail barefurrypaws. WINTER ONLY linedINDIGO denimjacket with ivorySHEARLINGcollar/cuffs, full-length ivoryTROUSERS coveringbothlegs, exposedpaws. Whitefivepetalyellowcenterdaisy anatomicalLEFTchest. Neverhat,scarf,bag,overalls orshorts. Cheerfulwarmgrounded actions.

### miso-base

Miso exact upright chestnutriverotter in reference LEFT figure, roundears creammuzzle cream eyebrowspots, browneyes, shortthicktaperedtail. BASE ONLY lavendercableknit sleevelessvest over ivory short-sleeved collaredshirt, warmgray pleatedSHORTS, exposedfurrypaws. Whitepetal yellowcenterdaisy on anatomicalLEFTchest. No hat/scarf/bag. Thoughtfulsteady bodyweight slowprecisehandwork.

### miso-summer

Miso exact upright chestnutriverotter in reference CENTER figure, roundears creammuzzle creameyebrowspots browneyes shortthicktaperedtail. SUMMER ONLY airy PALE LAVENDER light knit sleevelessvest over ivoryshortsleevedcollaredcottonshirt, warmgraylinenSHORTS, exposedpaws. Whitepetalyellowcenterdaisy anatomicalLEFTchest. No hat/scarf/cardigan/bag. Thoughtfulsteady littlebends/precisehands.

### miso-winter

Miso exact upright chestnutriverotter in reference RIGHT figure, roundears creammuzzle creameyebrowspots browneyes shortthicktaperedtail. WINTER ONLY lavenderBUTTONEDWOOL CARDIGAN over ivorycollaredshirt, FULL-LENGTH warmgraytailoredTROUSERS, exposedfurrypaws. Whitepetalyellowcenterdaisy anatomicalLEFTchest. No hat/scarf/bag/shorts. Thoughtfulsteady measuredgroundedactions.

### clover-winter

Clover exact upright ginger-andcream tabbykitten in reference RIGHT winterfigure. Greeneyes whitecream muzzletoes,fluffytail. WINTER ONLY sage knittedBEANIE with white daisy yellowcenter, ivory knittedSCARF, darktealbuttonedCOAT and matching darktealTROUSERS, cream paws. No strawhat,overalls,barelegs. Gentlecarefulgardener softcrouch and delightedface.

## Targeted fishing replacement

Transparent RGBA production sprite atlas, exact TWO columns THREE rows = SIX isolated fullbody poses, ONE fixed outfit. ReferenceONLYidentityoutfit. Finewarmoutlines mattepaintedcolor, fullytransparent cleanbackground no shadow/colorhaze. No labels/text/fish/line/bobber/water/particles. Fixed3quarterrightcamera, samebodysize allframes, groundedfeet. Characterholds ONEshortwoodenFISHINGROD andsmallreel inBOTHhands/pawsEVERYFRAME. Rodshaft continuousandvisible fromhandle toreeltotip; NEVER omit shaft inbraced/crankingposes; leavegeneroustransparentmargin aroundallrodtips. ROW1 cast: frame1 raise rodanticipation, frame2 extendarmscastforward rodangledright. ROW2 wait: frame3 patientrodhold, frame4 samehold briefblink. ROW3 reel: frame5 kneesbrace torsoleanbackBOTHhands holdfullrod diagonalup-right, frame6 lowerhandcranksreel upperhandholdsfullrodhandle diagonalup-right. Allsixshowcompleteone rodwithwoodshaft. Noextraobjects.

## Targeted digging replacement

Transparent RGBA production sprite atlas, exact TWOcolumns THREErows SIXisolated fullbodyposes,ONEfixedoutfit. Finewarmoutlines mattepaintedcolors exactreferenceidentity. No labels,text,backdrop,shadows,colorhaze,WHITEBLOBS,glow,groundpatch,dirt,particles. Cleantransparentgutters. Fixed3quarterrightcamera stablecharacterheadbodysize allframes. BothhandsgripONEshortwoodhandlemetalspade continuously. Six chronological keyposes: 1standingready shovel blade lower right;2kneesbend raiseblade;3bladecontactgroundlower-right asbodybends;4crouchpresslever kneesdeepbothhandsgrip;5liftshaftgentlyandtipbladeoutward;6lowertoolandriseinto standingready. Feetgrounded,normaljoints,nojumping,nocamera movement. Generousmarginsalltoolsinsidecell. No opaque straypieces between hands and background.

## Identity repair

The Miso baseline fishing replacement was edited with the original fishing atlas as the target and the approved wardrobe sheet as a reference. The only requested change was the small white five-petal daisy with a golden-yellow center on the anatomical left chest, preserving all six poses, full rods, clothes, alpha and layout. Per-character provenance identifies accepted files and export hashes. A regenerated raster may require newly measured crops; prompt coordinates are not trusted as packing metadata.
