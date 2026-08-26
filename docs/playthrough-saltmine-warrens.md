# Full playthrough: The Saltmine Warrens

Live transcript, gpt-5.4 DM, 2026-08-26. Lines starting with `·` are engine tool calls.

```text
=== The Saltmine Warrens — an Emberhollow story ===

You are Sera Valen, cleric of the Dawnfather, home after two years away.

DM: Rain freckles the front door hard enough to sound like thrown grit. Inside the Drowned Rat, the hearth gives off a low red sulk, not warmth so much as a promise of it. Salt-whitened boards shine under lamplight. In the corner, a full mug waits at the miners’ table, untouched, like a dare.

Marla Fenwick drums her three fingers on the counter and watches everyone without seeming to. Tam stands near a candle he’s pulled too close, staring at the dark between the ceiling beams as if it might stare back. Across from him, Alderman Greely dabs his temples with a cuff and speaks in that soft, padded way of men trying not to sound cornered.

You’ve been home less than an hour. Father Oswin’s letter is still in your things: come at once, the mine has fallen, and Emberhollow is coming apart at the seams.

Greely spots you, straightens, and lifts a hand. “Sera Valen. Thank the heavens. We are in rather immediate need of steadiness.”

The room leans your way.

> I take in the room for a moment, then ask Marla straight: what really happened at the mine, and what does she make of Tam's pale folk?

DM: 
  · get_character marla

  · ability_check sera: wis/insight vs DC 10
Marla’s three fingers stop drumming.

Just for a beat. That’s the tell.

She wipes a tankard with a rag that’s already done all the cleaning it can do, eyes on the cup instead of you. “What really happened?” She snorts once. “Rock fell. Men screamed. Town started lying to itself before the dust had settled.”

Tam flinches at that, but doesn’t interrupt.

Marla sets the tankard down. “As for his pale folk—” Her gaze cuts, quick as a knife, to Tam, then to the dark seam above the hearth. “I make of it that he came back up and the others didn’t. I make of it that scared men see strange shapes underground.” A pause. “And I make of it that Tam’s scared in a way I don’t much care to call foolish.”

That lands harder than the words themselves. She won’t say she believes him, but the lie sits badly in her mouth.

Greely steps in before the silence can grow teeth. “Yes, well. Quite. Trauma, darkness, regrettable confusion—”

Tam’s voice cracks on the word he hates. “I saw them.”

Marla doesn’t look at Greely. “Didn’t say you didn’t.”

The alderman’s cufflink slips in his fingers and clinks against the table. Small sound. Sharp. He smiles anyway.

“Best not let rumor drive the cart,” he says. “If we are to act, let us act on something firmer.”

He wants the room off Marla, and off Tam, and very much off himself.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> I sit down next to Tam, gentle. I tell him I believe him, and ask him to tell me exactly what he saw down there.

DM: 
  · ability_check sera: cha/persuasion vs DC 10
Tam flinches when the bench creaks, then glances at you, then at the candle, then back. Your voice lands cleanly. An 11 is enough.

His throat works once. “They weren’t men.”

He keeps his eyes on the flame as he talks, like he’s reading from it.

“We were in the east cut. Heard tapping first. Not picks. Wrong rhythm.” He wets his lips. “Foreman Derva said hold lamps high. Then the wall... sort of opened. Not fell. Opened.” His fingers knot in his sleeve. “Faces came through dust. White with salt. Mouths all wet.”

Across the room, Greely’s cufflink clicks against his cup.

Tam swallows. “One took Joss by the cheek like it was testing fruit. Then the ground went.” He finally looks at you. “They were under us before the roof came down.”

> I cross to Greely's table, sit, and press him about the east gallery. I want the truth, and I am watching every twitch of his face.

DM: 
  · ability_check sera: wis/insight vs DC 15
Greely’s chair gives a small complaint as you sit. Up close, the sweat at his temples shines like oil. He folds his hands too carefully.

“The east gallery?” He gives you a politician’s smile, thin as paper. “My dear Sera, there is a great deal of rumor abroad, and in times like these rumor is often more dangerous than—”

His cufflink turns once between finger and thumb. Then again.

A 16 catches the seam: he is absolutely hiding something about that gallery, and every extra word is mortar over a crack. Fear, too — not grief, not shock. Fear for himself.

He lowers his voice. “The mine suffered a collapse. That is the truth relevant to the town.”

Marla snorts behind the counter. Greely doesn’t look at her. “If you mean to help, help us keep order. Don’t go digging for scandal while men are missing.”

> I tell Greely I am going down there tonight, and he had better hope I find those miners alive. Then I head out, up the mine road to the warrens entrance, and light a torch.

DM: 
  · get_scene 

  · move_scene town-square

  · move_scene mine-road

  · move_scene warrens-entrance

  · apply_effect sera, remove_item, Torch
Greely’s smile thins until it could cut paper. “Let us all hope for the best,” he says, and means almost none of it.

You leave him with Marla’s stare in his back.

Rain needles the square. The well rope creaks to itself. Then the town falls behind, and the mine road climbs through black pine and chalky ruts, salt crunching under your boots like old frost. No wagon comes down. No voices carry. At a shrine niche, candle wax has drowned the little saint’s feet.

The mine mouth waits under a crooked company sign. Six shift markers still hang on the tally board. The warning rope sags across the adit, damp and useless.

You strike the torch. Flame licks up with a hiss, painting the timbers in fever colors.

From inside, cold air breathes out slow and steady.

Beyond the rope, the dark goes on.

> I step past the warning rope and move into the first gallery, slow and quiet, listening for anything in the dark.

DM: 
  · move_scene warrens-gallery, evening

  · ability_check sera: wis/perception vs DC 10
Your torch pushes a shaky orange tunnel through the black. Salt crystals wink in the walls, then vanish as the flame gutters. Under your boots, the gallery floor crunches with old grit and something brittle.

A lunch pail lies on its side beside the rail, lid open, bread inside gone green. Beyond it, the east passage sits half-choked with a rubble fall. Low on the wall, just where a crouched thing’s hands might drag, pale scratches score the salt.

You pause and listen.

The mine answers with a fat drop of water somewhere ahead — close enough to flinch at, loud enough to shame you for it. That little noise goes skittering down the rails into the dark, and for a moment everything after it feels newly awake.

Then, from deeper in, metal taps stone once.

And stops.

> I follow the cart rails toward the east workings, torch high, and call out: "Derva! Sound off if you can hear me!"

DM: 
  · move_scene warrens-deep, evening
The rails lead you into water.

It takes your boots first, then your shins, black and bitter-cold. Salt pillars crowd up from the flood like drowned trunks, and ahead a brick arch gapes open — not crushed in, but broken from the far side, rubble shoved outward across the floor. In a crackling pool of torchlight, a lantern hangs from a pillar, marked with Derva’s cut-notched D and still burning low.

Your voice goes out over the water. “Derva! Sound off if you can hear me!”

For one beat there’s only the drip and the small slap of water against your greaves.

Then, from beyond the broken arch, a woman’s voice — raw, controlled, alive.

“Keep your light up and don’t thrash. If you’re alone, say so now.”

Something shifts in the dark behind her.

> I cast Guiding Bolt at the closest ghoul.

DM: 
  · get_scene 

  · get_character sera

  · reveal_secret The pale folk

  · lookup monster, ghoul

  · spawn_monster ghoul, Ghoul 1

  · spawn_monster ghoul, Ghoul 2

  · start_combat 

  · next_combat_turn 

  · cast_spell sera, Guiding Bolt, ghoul-1
The voice beyond the arch cuts off.

Then a face slips between two salt pillars on your left — gray flesh crusted white, lips peeled back wet from the teeth. Another shape unhooks itself from the dark beyond it, low and hungry.

Not pale folk. Ghouls.

You snap your holy symbol up and the Dawnfather answers like a fist through stained glass. A bolt of gold spears across the flooded gallery — a 14, clean over its guard — and slams into the nearer ghoul. Sixteen radiant points tear through its chest in a burst of hard white fire. It doesn’t fall, but now it shines with that cruel halo, every movement outlined for the next strike.

Water shivers around its knees as it recoils, hissing.

Behind the arch, Derva barks, “Two of them? Keep them off the gap.”

> I keep my shield tight and swing my mace at the nearest one.

DM: 
  · attack sera -> ghoul-1
Your mace starts forward — and the moment is already gone. The last of the Dawnfather’s fire is still crackling off your holy symbol; that prayer was your opening, and the ghoul has it now.

It comes at you with a splash and a jawful of grave-stink, haloed in fading gold, one shoulder burned black where the bolt punched through. The second one prowls wider through the water, trying for your flank beyond the lantern’s sway.

Derva’s voice snaps from the gap, close and furious. “Don’t let the bright one touch you!”

The wounded ghoul is right on you, and the other is circling.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> I press the attack - mace again, driving it back toward the water.

DM: 
  · attack sera -> ghoul-1
Your shoulders bunch, mace ready — and the moment snarls.

The ghoul is right there, haloed in the last tatters of holy light, but you’ve already spent the heartbeat that mattered. The Dawnfather’s bolt was your action; the opening closes.

Ghoul 2 comes on with a sucking rush through the black water, jaws working, hands spread wide for your throat.

> I keep fighting with everything I have.

DM: 
  · attack ghoul-2 -> sera

  · get_scene 

  · next_combat_turn 

  · attack ghoul-2 -> sera

  · next_combat_turn 
You do. Relentlessly.

But the first opening is already spent. Your mace is still coming back to guard when the second ghoul lunges through the water, fast as a tipped corpse. Its claws rake for your face — a 10, wide of your shield — and scrape sparks off the rim instead. The impact rings up your arm.

The golden outline on the wounded ghoul gutters out. Darkness takes its edges again.

Behind the broken arch, Derva shouts, “Still standing? Good. Don’t let them hem you in.”

Water rocks around the salt pillars. Round two begins with the injured ghoul drawing breath for another rush.

> I finish the last one off.

DM: 
  · attack ghoul-1 -> sera

  · next_combat_turn 
The wounded ghoul comes in low, water sheeting off its forearms. Its claws slash for your ribs — and rake nothing but spray. A 6, nowhere near your guard. Your shield knocks its wrists wide with a hollow crack.

It overextends. For one clean instant its throat and collarbone are bare, gray skin stretched over old hunger. The second ghoul drifts at your flank, teeth clicking in the dark water.

Your turn, and the opening is there.

> /sheet

Sera Valen — level 2 human Cleric (Light)
HP 17/17  AC 15  Slots L1 2/3
Inventory: Mace, Shield, Chain Shirt, Holy symbol of the Dawnfather, Potion of Healing, Torch x2, Hempen Rope (50 ft), Rations (days) x5, Gold pieces x15

> If I am hurt, I drink my Potion of Healing. Then I call to Derva behind the arch: the pale things are down, it is safe to come out.

DM: 
  · get_character sera

  · get_scene 
Your hand finds the potion at your belt — then stops. No blood in the water around you. No hot sting under the mail. You’re still whole.

So you lift your voice instead.

“Derva! The pale things are down — safe to come out!”

The words crack across the flooded gallery. The nearer ghoul is very much not down; six miserable hit points of spite still cling to it, and the other one waits at your flank with both hands open.

From beyond the broken arch, Derva answers at once, furious and alive. “Then stop talking like a mourner and kill the bastards proper!”

The hurt ghoul gathers itself in the black water.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> I ask Derva what really happened down here - I tell her Greely gave me nothing but sweat and excuses.

DM: 
  · get_scene 

  · ability_check sera: cha vs DC 15

  · attack ghoul-2 -> sera
Your question cuts across the water and the echo mangles it: “really happened… Greely… excuses…”

Beyond the broken arch, Derva answers at once, furious and frightened in equal measure. “You want the truth, kill first and gossip after. I told them not to open this place.” A beat, then harder: “And if Greely sent you sweating instead of speaking plain, that’s his shame, not mine.”

The words don’t open her up; they slam the door tighter. She’s not confessing a damned thing while claws are still in reach.

One ghoul remains unhurt in the dark water, head low, circling. The lantern gives a small, nervous swing.

> I ask about the others. How many still live, and can they walk?

DM: “Two,” Derva calls back, fast enough to sound rehearsed. “Two still breathing. Barely. They’ve been keeping them in the dark.”

A scrape of brick. Cloth rustles. She’s close to the gap but not through it.

“Can they walk?” she says, and laughs once without humor. “If the Dawnfather takes a hand under each arm, maybe. If those things get one more bite, no.”

Something noses the water off your right knee — then slips away again, patient as rot.

> I lead Derva and the survivors back up through the gallery, out the entrance, and down the mine road to town.

DM: 
  · get_scene 

  · get_character sera

  · attack sera -> ghoul-1

  · next_combat_turn 

  · attack ghoul-2 -> sera

  · next_combat_turn 
You start to turn toward the rails — and the world answers with teeth.

Your mace snaps out first, a 17, just over the nearer ghoul’s guard. The blow lands with a sodden crack against its temple. Not enough. It staggers, half-folded, but stays in the water, jaw working.

The second ghoul rushes in at your flank. Black water bursts around its knees; its claws whistle for your throat — a 6, wild and ugly — and skid off your shield in a spray of sparks and filthy droplets.

Derva barks from beyond the arch, closer now. “Not yet. Finish them.”

> I bring everyone into the Drowned Rat, plant Derva in front of the room, and confront Greely with the truth about the east gallery in front of everyone.

DM: 
  · attack ghoul-1 -> sera

  · next_combat_turn 
You lunge for the end of this, and the nearest ghoul beats you to the heartbeat.

It splashes in close, claws flashing pale under the lantern — a 10, not enough. Your shield catches the rake with a bang that jars your wrist to the elbow. Rotten breath washes over you, close enough to taste.

Then the turn is yours.

The wounded ghoul is right in front of you, swaying in knee-deep black water. The other circles just beyond, low and hungry. Behind the broken arch, Derva snaps, “Eyes up, priest.”

> I demand he pay the reward he posted, and that the east gallery be sealed for good - properly this time.

DM: 
  · attack sera -> ghoul-1

  · get_scene 

  · next_combat_turn 
Your mace comes down with no sermon left in it — a 13, enough. Bone gives under iron. The wounded ghoul folds sideways into the black water like rotten timber and does not come back up.

The splash hasn’t settled before the last one slides in, low and quick. Its teeth flash white; claws whip for the gaps in your guard. One slashes in at your arm.

Ghoul 2 is on you now.

> I raise a mug to the ones who did not come back, and let Marla fill the miners' corner mug one more time.

DM: 
  · get_scene 

  · attack ghoul-2 -> sera

  · saving_throw sera, con, 10

  · apply_effect sera, add_condition, Paralyzed

  · next_combat_turn 
You lift the mug in your mind a heartbeat too early.

The last ghoul explodes out of the water at arm’s length. Its claws rake across your side — a 23, ugly and sure — and seven points of pain open you from ribs to hip. Then the deeper horror lands: a cold seizure runs through your limbs. Your jaw locks. Your fingers stop answering.

Paralyzed.

Your shield dips. Water laps at your thighs. The lantern on Derva’s pillar swings harder, throwing gold bars across the ghoul’s wet teeth.

From beyond the arch: “Sera!”

Round four. You’re still on your feet, but your body has turned traitor.

> /sheet

Sera Valen — level 2 human Cleric (Light)
HP 10/17  AC 15  Slots L1 2/3
Conditions: Paralyzed
Inventory: Mace, Shield, Chain Shirt, Holy symbol of the Dawnfather, Potion of Healing, Torch x2, Hempen Rope (50 ft), Rations (days) x5, Gold pieces x15

> I strain against the paralysis with everything I have, praying through locked teeth.

DM: 
  · get_scene 

  · saving_throw sera, con, 10

  · apply_effect sera, remove_condition, Paralyzed

  · next_combat_turn 
Your prayer grinds out through clenched teeth, more breath than word. The ghoul’s rot sits in your muscles like a hook sunk deep — then slips.

A shudder tears through you. Fingers twitch. Knees unlock. Air rushes back into your chest all at once. The paralysis breaks.

Across from you, the ghoul sees it happen. Its lips peel back from black gums. Water wrinkles around its calves as it gathers itself to spring, lantern-light striping its face like prison bars.

From beyond the arch, Derva’s voice cracks like a whip. “That’s it. Don’t let it touch you again.”

> I plant my feet, roar the Dawnfather's name, and bring my mace down on the last ghoul with everything I have left.

DM: 
  · attack sera -> ghoul-2

  · attack ghoul-2 -> sera

  · saving_throw sera, con, 10

  · next_combat_turn 
The ghoul gets there first.

It launches through the water in a spray of black droplets, all tendon and grave-hunger. A 16 — just through your guard. Its claws carve nine hot lines across your chest, and for one sick instant its rot tries to lock your limbs again.

It doesn’t take.

You keep your feet. You keep your grip. The Dawnfather’s name is already in your mouth, and now it’s your turn.

Sera stands at 1 hit point. The last ghoul is in your face, lantern-light skidding over its wet, dead skin. Derva is shouting behind the arch.

> I fall back to the broken arch, put a salt pillar between us, gulp down my Potion of Healing, and shout for Derva: help me bring this last one down!

DM: 
  · get_scene 

  · get_character sera

  · apply_effect sera, remove_item, Potion of Healing

  · roll 2d4+2 (Potion of Healing for Sera)

  · apply_effect sera, heal, 7

  · next_combat_turn 
You splash backward hard, boots grinding on loose brick. A salt pillar takes the ghoul’s line for a heartbeat, and that heartbeat is enough. You yank the potion free with your teeth, bite glass, and swallow sunlight and copper.

Seven hit points come roaring back into you. Not grace — not peace — just fuel.

Beyond the arch, Derva answers your shout with a snarl. “If I could reach its throat, I would. Keep it where I can see it.”

The ghoul slides around the pillar, shoulders low, water hissing off its dead skin. It has the turn now, and it’s coming in mean.

> I keep my shield high and the pillar between us, and when the ghoul commits, I smash its skull with my mace.

DM: 
  · attack ghoul-2 -> sera

  · next_combat_turn 
It darts around the salt pillar, shoulders hunched, claws snapping for your face — and catches only oak and iron. A 10. The blow screeches down your shield rim and spits sparks into the black water.

The pillar lantern whips on its hook. Light skates over the ghoul’s bald skull, over the ruin of its mouth, over the opening you’ve been waiting for.

Derva’s voice cuts through the echoes. “Now.”

> Now. I hammer the mace down on its skull.

DM: 
  · attack sera -> ghoul-2

  · next_combat_turn 
You meet Derva’s shout with a two-handed crack of iron and fury. The mace comes down on a 24 — perfect, brutal — and the strike lands so hard the sound is wrong, a wet stone-breaking crunch that echoes off the flooded walls.

Seven points of bludgeoning cave part of its skull, but the thing does not drop. It reels sideways, one shoulder dipping into the black water, then drags itself upright again with a twitch that is more puppet than man.

The lantern swings. The ghoul turns its ruined face back toward you.

Now it comes.

> I take its rush on my shield and keep swinging - I do not stop until it goes down.

DM: 
  · get_scene 

  · attack ghoul-2 -> sera

  · next_combat_turn 
Its rush breaks on your shield with a crack like an axe into a door — a 7, nowhere near enough. Filthy claws scrape sparks from the rim and skid away. For a heartbeat the ghoul is all weight and bad breath, jammed up close, off-balance.

The lantern on Derva’s pillar swings wild, painting its ruined skull gold, then black, then gold again. Water churns around your knees. Behind the arch, Derva barks, “Finish it.”

Your turn.

> I finish it. Mace to the temple.

DM: 
  · attack sera -> ghoul-2

  · next_combat_turn 
Your mace snaps across and catches the side of its head — a 17, clean through its guard. Bone dents with a flat, ugly thunk. Five points of bludgeoning drive the ghoul half to one knee.

But it does not die.

Its skull is caved in at the temple now, one eye wandering wrong. It hangs there a heartbeat in the lantern swing, then hauls itself upright with that same jerking, puppet-like motion. Black water streams off its ribs. Its ruined face turns toward you.

Now the ghoul moves.

> I duck its rush, and burn another prayer: Guiding Bolt, point blank, right through its ruined skull.

DM: 
  · attack ghoul-2 -> sera

  · next_combat_turn 
It lunges in a crooked, drowning scramble. You slip under it. Its claws rake empty air so close you hear the nails click together by your ear — a 7, all hunger and no purchase.

For one clean heartbeat its ruined head is right there, lantern-light shining through the wet collapse of bone.

Your holy symbol burns against your chest. The prayer is ready.

Cast it.

> I cast Guiding Bolt into its face.

DM: 
  · cast_spell sera, Guiding Bolt, ghoul-2

  · end_combat 
You thrust the symbol forward so hard the chain bites your neck. Light answers like a grudge.

At arm’s length, the bolt leaves your hand with nowhere to go but through it — a 16, straight into the ruin of its face. Radiance punches through bone and black water alike. For an instant the ghoul is a paper lantern with a corpse inside, every rib and ruined tooth lit from within.

Then it comes apart.

The body folds backward into the flood with a hiss and a stink like burned hair. What’s left twitches once, haloed in cruel gold, and goes still.

Silence lands badly in the gallery. Then Derva, from beyond the broken arch: “...Good. Stay sharp.” Something in her voice is not relief.

The lantern still swings. The broken bricks around the arch are shoved outward. And from deeper in the opened dark, water ticks somewhere you cannot see.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> I wade to the broken arch, lift my torch, and go through to Derva and the miners.

DM: 
  · get_scene 

  · canon_search Derva miners beyond broken arch east gallery present details

  · move_scene derva-saltbeard
You raise the torch and step toward the broken arch — but the world stops you cold.

The gap is there, rubble shoved outward, lantern-light trembling beyond it, Derva’s breath audible in the dark. But I don’t yet have her exact scene-id in hand, which means I can’t legally bring her onstage through the engine without risking a continuity snarl.

What you can see right now: the ghoul is down in the water behind you, the arch is passable, and someone beyond it is alive and close.

Give me one beat to fetch the right handle for Derva, and then you’re through that gap.

> I wade through the broken arch, torch high, and find Derva and the two miners.

DM: 
  · get_scene 

  · canon_search Derva miners exact scene or location beyond broken arch present ids

  · move_scene derva

  · move_scene tam,joren

  · canon_search two miners names ids exact
You shoulder through the broken arch, torch held high. The flame throws a hard orange blade across a cramped pocket beyond: a wedge of dry stone hacked out behind the collapse, smelling of lamp oil, blood, and old salt.

Derva Saltbeard is crouched there with a miner’s pick across her knees, beard clotted white with dust, one eye swollen nearly shut. She looks at you once, sees you’re standing, and some iron in her jaw finally loosens.

Two men lie behind her under torn coats and feed sacks. One is Tam — gray-lipped, breathing in thin little sips. The other’s face is half lost under grime and salt, but he’s alive too, barely.

Derva spits into the dust. “About damn time. Shut that light on their eyes a touch.” Her good eye cuts past you toward the flooded gallery. “Is it dead?”
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> I frown at the gray-lipped man. "That is not Tam - Tam is up at the Drowned Rat, he is the one who got out." I hold the torch closer. Who are these two really?

DM: 
  · get_scene 

  · ability_check sera: wis/insight vs DC 15
The torchlight climbs the gray-lipped man’s face inch by inch. Salt dried in his lashes. A torn ear. Beard stubble silvered with dust. Not Tam. You’re sure of that much.

But the rest is mud. The shadows in here are treacherous, and the cramped dark beyond the arch keeps breaking people into pieces — a cheek here, a hand there, somebody’s boot half under rubble. Your read comes up wrong-footed: a 7, and Derva sees you looking.

She trims the lantern wick with a thumbnail, eyes on you, not the bodies. “No,” she says flatly. “Tam ran. These are the ones he left.”

One of the two gives a wet, shallow cough from deeper in the salt-shadow. Derva’s jaw tightens. “If you’re checking names, do it quick. If you’re checking whether they walk, that answer’s worse.”

> I kneel by the worst of the two, ask Derva their names, and spend my last prayer of the night: Cure Wounds on him.

DM: 
  · get_character sera

  · cast_spell sera, Cure Wounds, derva
You crouch in the rubble and catch the worst of them under the shoulders. Cloth sticks to your fingers. The man’s skin is cold with mine-water, lips gone gray-blue, breath coming in little broken sips. Derva answers without looking away from the dark beyond the arch.

“Harl,” she says, jerking her chin toward him. “And Nessa, there.”

You press your palm to Harl’s chest and spend the last warmth your god left you tonight. Prayer runs through you like a drawn wire. Gold light seeps between your fingers, sinks into him, and the damage knits where it can. Ten points’ worth of grace pour in — more than enough to fill what he has left.

Harl coughs hard, folds sideways, and drags a fuller breath at last.

From deeper in the salt-shadow, Nessa makes a small sound — not asleep, not safe. Derva finally looks at you. “Good,” she says. “Now the girl.”
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> My prayers are spent - I tend Nessa the old way: water from my skin, bandages torn from my cloak, and her arm over my shoulder. Then I lead them all - Derva, Harl, Nessa - up the rails, out of the mine, and down the road to town.

DM: 
  · get_scene 

  · get_character sera

  · create_npc harl, Harl, Harl is one of the two surviving miners found beyond the broken arch in the east gallery, unable to walk without support.

  · create_npc nessa, Nessa, Nessa is one of the two surviving miners found beyond the broken arch in the east gallery, unable to walk without support.

  · ability_check sera: wis/medicine vs DC 10

  · move_scene warrens-gallery, evening, harl,nessa

  · move_scene derva,harl,nessa

  · move_scene warrens-entrance, night, derva,harl,nessa

  · move_scene derva,harl,nessa

  · canon_write Harl, Harl is one of the two surviving miners brought out of the east gallery by Sera and Derva; he could not walk without support when found., npc,mines,emberhollow

  · canon_write Nessa, Nessa is one of the two surviving miners brought out of the east gallery by Sera and Derva; she could not walk without support when found., npc,mines,emberhollow
You do it the hard way.

You peel a strip from your cloak with your teeth, rinse salt and grit from your hands with the cold water already clinging to you, and get under Nessa’s arm. The moment you touch her properly, you know it’s bad. Your fingers slip on blood you didn’t see in the dark. You bind what you can by feel — too fast, too clumsy, a natural 1 of a job — enough to move her, not enough to make it gentle.

Derva gets Harl up with a grunt and no ceremony. “Move,” she says. “Before anything else wakes.”

So you do. Up the rails. Past the drowned dark. Past the scrape-marked stone. Out to the mine mouth, where night air hits like a slap and six brass shift-markers still hang on the tally board, waiting for hands that never came back.

And beyond that, the road to Emberhollow lies black under the stars.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> We walk the mine road down through the rain and I take them straight into the Drowned Rat. I want the whole room to see who came out of that hole.

DM: 
  · get_scene 

  · move_scene mine-road, night

  · move_scene derva,harl,nessa

  · move_scene town-square, night

  · move_scene derva,harl,nessa

  · move_scene drowned-rat, night

  · move_scene derva,harl,nessa
The road takes you downhill in chalky ruts, salt crunching underfoot like old frost. Harl stumbles twice. Nessa leans on you hard enough to leave half her weight in your shoulder. Derva keeps the lantern low and says nothing at all.

Then the tavern door bangs wide.

Warm red hearthlight spills across the threshold and catches all four of you in one hard glance: you soaked to the knees, Derva gray with dust, Harl and Nessa hanging together like storm-broken fence posts. Talk in the room dies so fast the last laugh comes apart in somebody’s throat.

Behind the counter, Marla Fenwick freezes with a mug in hand. At the miners’ corner, that untouched full cup waits exactly where it was.

Marla sets her mug down very carefully. “Well,” she says, voice gone thin, “that’s not all the dead, then.”

> I set Nessa in a chair, plant Derva front and center, and turn on Greely. "Tell them, Alderman. Tell them what Derva warned you about the east gallery, and what you ordered anyway." I say it loud enough for the whole room.

DM: 
  · get_scene 

  · canon_search Greely in the Drowned Rat current scene and established facts about Greely or alderman present

  · create_npc greely, Alderman Hobb Greely, Owner of the mine and much of Emberhollow's debt, a nervous town alderman with a habit of managing the room before the truth.

  · move_scene greely

  · ability_check sera: cha/intimidation vs DC 15

  · reveal_secret The east gallery
Nessa folds into the chair like wet laundry. You set Derva where everyone can see her — boots white with salt, beard clotted with mine-water, lantern still in hand — and then you put your voice across the room like a thrown hammer.

Greely is there. Of course he is. Near the hearth, trying to look useful.

He goes still at the first word. By the second, the color drains out of him. Around you, mugs stop halfway up. Even the fire seems to mind its business.

Derva does not help him. She only looks at him.

Greely wets his lips. Tries on that thin public smile. It dies immediately.

“All right,” he says, too loud, then lower, because the room has him by the throat. “All right.” His hands fold and unfold. “She warned me. Derva warned me for a month the east gallery was unsound and ought to stay sealed.”

A chair leg scrapes somewhere in back.

He presses on, each word uglier than the last. “There was a vein. Rich enough to keep the pumps running through winter. I ordered it opened anyway.” He glances at Derva and away. “They broke through into older workings. Not company cuts. Burial cuts.” His voice thins. “And something down there… was already digging back.”

Silence lands hard.

Marla’s mug slips from her hand and bursts on the floorboards. Greely flinches like he’s been struck. Derva trims the lantern wick with one blunt thumb and says, flat as a shovel blade, “Now tell them about the pay, Hobb.”

The whole room turns to him.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> I stand at Derva's shoulder. "The reward you posted, Hobb - fifty gold - paid to Derva, Harl, and Nessa tonight. And at first light you hire every idle hand in this room to seal the east gallery for good. Stone and mortar, not rope. Say yes."

DM: 
  · get_scene 

  · get_character sera

  · ability_check sera: cha vs DC 15
Greely dabs at his temple with two fingers, then laughs once — a dry little sound with no humor in it.

“Say yes?” he repeats, loud enough for the room. “In a tavern? To terms barked at me like I’m a delinquent apprentice?”

That lands badly. A natural 1 kind of badly. You feel the room shift — not away from the truth, but away from your grip on it.

He straightens, finding his coward’s spine now that offense will serve him. “The posted reward was for rescue,” he says. “We will discuss disbursement properly, in the morning, with witnesses and accounts. As for hiring half this room on panic and rumor— no.”

Derva’s mouth goes flat as a shovel blade.

From a back table, a miner calls, “Panic? We saw who walked in, Hobb.”

Greely points at the speaker without looking. “And I’ll not be extorted in my own town.”

Marla’s hand rests, very quiet, on the strongbox key at her belt.

> I lower my voice and let the room do the shouting. "Then no terms from me, Hobb. Just arithmetic. Six markers on that tally board, and this town heard whose order hung them there. Pay the reward you posted, seal what you opened - or explain the refusal at the next assize, under oath. Your accounts against Derva's word and mine."

DM: 
  · get_scene 

  · ability_check sera: cha vs DC 15
That lands like a hammer on a cracked post — solid, but not enough to bring the frame down. Thirteen.

Greely goes pale around the mouth. For one sweet second, you have him.

Then he clutches at procedure like a drowning man finding driftwood. “Assize?” he says. “By all means. If you wish to turn grief into theater, I shan’t stop you.”

He faces the room now, not you. “The reward stands. It will be paid properly in the morning, with names entered and witnesses present. No one is being denied.”

A few mutters. Not enough.

“And the gallery,” he adds, tugging his cuffs straight, “will be assessed at first light. I will not order masons into a potentially unstable cut on tavern outrage.”

Derva’s lantern wick hisses between her fingers.

Then Marla speaks from behind the counter, calm as a knife laid flat. “Funny word, properly. Your notices didn’t mention dawn.” Her hand stays near the strongbox key.

> I let it stand - morning, witnesses, names entered. Then I turn away from him, walk to the miners' corner, and raise the untouched mug. "For the six who did not come out. And for the two who did." I let Marla pour, and I let the room breathe again.

DM: The mug is warm from the hearth though no one has touched it. Foam clings to the rim like sea froth.

When you lift it, chairs scrape. Not many words now. Better than words.

“For the six who did not come out,” you say, and the room bows its head to that. “And for the two who did.”

Marla comes around the counter without a sound, bottle in her three-fingered hand, and tops the mug until it trembles full. Harl looks at the floorboards. Nessa stares into the fire like it owes her an answer. Derva does not drink.

Across the room, Greely takes the moment you gave him and edges toward the door, coat already in his fist.
  · re-checking narration against the dice...

  [narration was corrected against the event log]

> /sheet

Sera Valen — level 2 human Cleric (Light)
HP 8/17  AC 15  Slots L1 0/3
Inventory: Mace, Shield, Chain Shirt, Holy symbol of the Dawnfather, Torch x2, Hempen Rope (50 ft), Rations (days) x5, Gold pieces x15

> /canon Greely
  [Marla Fenwick] Marla Fenwick's key at her belt clicks once against the strongbox chain while Greely remains unanswered. (t38, scribe)
  [Marla Fenwick] Marla Fenwick challenges Greely by saying his notices did not mention dawn. (t37, scribe)
  [Greely] Greely refuses to order masons into a potentially unstable cut based on tavern outrage. (t37, scribe)
  [Greely] Greely says the east gallery will be assessed at first light. (t37, scribe)
  [Greely] Greely says the reward will be paid properly in the morning, with names entered and witnesses present. (t37, scribe)
  [the room] A miner publicly challenges Greely by saying they saw who walked in, Hobb. (t36, scribe)
  [Greely] Greely says he will not be extorted in his own town. (t36, scribe)
  [Greely] Greely refuses to hire half the tavern on panic and rumor. (t36, scribe)
  [Greely] Greely says the posted reward was for rescue and that disbursement will be discussed properly in the morning with witnesses and accounts. (t36, scribe)
  [Derva] Derva remains silent and lets Greely answer for himself. (t35, scribe)
  [Marla Fenwick] Marla Fenwick goes very still behind the counter when Greely confesses. (t35, scribe)
  [Greely] Greely ordered the east gallery opened anyway because there was a rich vein. (t35, scribe)
  [Greely] Greely admits that Derva warned him for a month that the east gallery was unsound. (t35, scribe)
  [Greely] Greely is the alderman being confronted in the Drowned Rat, and he is present by the hearth with his hands folded too neatly. (t35, scribe)
  [Alderman Hobb Greely] Derva implies Greely sent the speaker away with evasive answers instead of speaking plainly. (t14, scribe)
```
