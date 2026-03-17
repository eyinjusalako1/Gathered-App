export interface DailyWordEntry {
  title: string
  reference: string
  text: string
  reflection: string
  prayer: string
  reflectionPrompt: string
  reflectionHelper: string
  focus: string
  focusLabel: string
}

type BaseDailyWordEntry = Omit<
  DailyWordEntry,
  'reflectionPrompt' | 'reflectionHelper' | 'focus' | 'focusLabel'
>

const versePools: Record<string, BaseDailyWordEntry[]> = {
  peace: [
    {
      title: 'The Lord Is My Shepherd',
      reference: 'Psalm 23:1-3',
      text: 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters.',
      reflection:
        'Where do you feel restless today?\nLet this passage remind you that God is present and guiding.\nNotice the places where He is already providing calm.\nAsk Him to lead you beside still waters again.',
      prayer:
        'Shepherd of my soul, lead me to quiet places today.\nRestore my heart with Your peace.',
    },
    {
      title: 'Peace I Leave With You',
      reference: 'John 14:27',
      text: 'Peace I leave with you; my peace I give to you. I do not give to you as the world gives.',
      reflection:
        'Jesus offers a peace that does not depend on circumstances.\nWhat worries can you release to Him right now?\nLet His promise replace fear with trust.\nReceive His peace as a gift.',
      prayer:
        'Jesus, I receive the peace You give.\nGuard my mind and heart today.',
    },
    {
      title: 'Do Not Be Anxious',
      reference: 'Philippians 4:6-7',
      text: 'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.',
      reflection:
        'Bring your honest concerns to God instead of carrying them alone.\nPrayer is not a last resort; it is the first response.\nLet gratitude shift your focus from fear to faith.\nGod’s peace meets you in surrender.',
      prayer:
        'Father, I bring You my worries and ask for Your peace.\nTeach me to trust You in every situation.',
    },
    {
      title: 'Perfect Peace',
      reference: 'Isaiah 26:3',
      text: 'You will keep in perfect peace those whose minds are steadfast, because they trust in You.',
      reflection:
        'Peace grows as we fix our minds on God.\nWhat thoughts do you need to hand over to Him?\nTrust is a steady choice, not a fleeting feeling.\nLet Him keep you today.',
      prayer:
        'God, anchor my mind on You and keep me in Your peace.\nStrengthen my trust today.',
    },
  ],
  discipline: [
    {
      title: 'Train Yourself in Godliness',
      reference: '1 Timothy 4:7',
      text: 'Train yourself in godliness.',
      reflection:
        'Spiritual growth is built through small, faithful practices.\nWhat simple habit can you take up today?\nConsistency shapes your heart over time.\nAsk God for strength to start.',
      prayer:
        'Lord, help me grow through faithful discipline.\nGive me the desire and strength to follow You daily.',
    },
    {
      title: 'Discipline Produces Peace',
      reference: 'Hebrews 12:11',
      text: 'No discipline seems pleasant at the time, but it produces a harvest of righteousness and peace.',
      reflection:
        'God’s discipline is proof of His care.\nWhat is He shaping in you through this season?\nThe growth is worth the effort.\nLean into His loving guidance.',
      prayer:
        'Father, help me receive Your discipline with trust.\nForm a steady heart in me.',
    },
    {
      title: 'Do Not Grow Weary',
      reference: 'Galatians 6:9',
      text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest.',
      reflection:
        'Faithful obedience can feel slow, but it is not wasted.\nGod sees the small steps you take today.\nStay steady and keep moving forward.\nHope grows with perseverance.',
      prayer:
        'God, strengthen me when I feel tired.\nHelp me keep doing good with hope.',
    },
    {
      title: 'Doers of the Word',
      reference: 'James 1:22',
      text: 'Do not merely listen to the word, and so deceive yourselves. Do what it says.',
      reflection:
        'God’s Word invites action, not just reflection.\nWhat is one step you can take today?\nObedience makes truth real in your life.\nAsk for courage to apply what you learn.',
      prayer:
        'Jesus, make me a doer of Your Word.\nGive me courage to obey today.',
    },
  ],
  identity: [
    {
      title: 'New Creation',
      reference: '2 Corinthians 5:17',
      text: 'If anyone is in Christ, the new creation has come: The old has gone, the new is here.',
      reflection:
        'Your identity is rooted in Christ, not your past.\nWhat old story needs to be released today?\nGod is making you new in real ways.\nWalk forward in His truth.',
      prayer:
        'Jesus, thank You for making me new.\nHelp me live from the identity You give.',
    },
    {
      title: 'His Workmanship',
      reference: 'Ephesians 2:10',
      text: 'For we are God’s workmanship, created in Christ Jesus to do good works.',
      reflection:
        'You are crafted with purpose by God Himself.\nYour life is not accidental or overlooked.\nHe prepared good works for you today.\nStep into them with confidence.',
      prayer:
        'Father, remind me I am Your workmanship.\nLead me into the good works You prepared.',
    },
    {
      title: 'No Condemnation',
      reference: 'Romans 8:1',
      text: 'There is now no condemnation for those who are in Christ Jesus.',
      reflection:
        'Shame is not your portion in Christ.\nReceive the freedom Jesus purchased for you.\nLet grace define how you see yourself today.\nLive as someone forgiven.',
      prayer:
        'Lord, replace shame with Your grace.\nHelp me walk in freedom today.',
    },
    {
      title: 'Chosen People',
      reference: '1 Peter 2:9',
      text: 'You are a chosen people, a royal priesthood, a holy nation, God’s special possession.',
      reflection:
        'God chose you and calls you His own.\nYou belong, and you have purpose.\nLet this truth quiet any insecurity.\nLive today knowing you are His.',
      prayer:
        'God, thank You that I belong to You.\nHelp me live with confidence in Your love.',
    },
  ],
  purpose: [
    {
      title: 'Plans For You',
      reference: 'Jeremiah 29:11',
      text: 'For I know the plans I have for you, plans to prosper you and not to harm you.',
      reflection:
        'God’s plans are rooted in His goodness.\nEven when you cannot see the path, He can.\nTrust His timing and His heart.\nHe is leading you forward.',
      prayer:
        'Lord, help me trust Your plans for me.\nGuide my steps today.',
    },
    {
      title: 'Trust In The Lord',
      reference: 'Proverbs 3:5-6',
      text: 'Trust in the Lord with all your heart and lean not on your own understanding.',
      reflection:
        'Purpose is found in surrender, not control.\nWhat do you need to release today?\nGod promises to direct your path as you trust Him.\nTake one faithful step.',
      prayer:
        'God, I trust You with my path.\nMake my way clear and steady.',
    },
    {
      title: 'More Than We Imagine',
      reference: 'Ephesians 3:20',
      text: 'God is able to do immeasurably more than all we ask or imagine.',
      reflection:
        'Your future is not limited by what you see today.\nGod’s power is at work in you.\nDream with faith and humility.\nExpect His goodness to meet you.',
      prayer:
        'Father, do more than I can imagine in my life.\nExpand my faith and my vision.',
    },
    {
      title: 'All Things Working Together',
      reference: 'Romans 8:28',
      text: 'In all things God works for the good of those who love Him.',
      reflection:
        'God can weave every moment into purpose.\nEven the hard seasons are not wasted.\nHold on to His promise today.\nHe is still at work.',
      prayer:
        'Lord, help me trust You are working for good.\nGive me patience and hope today.',
    },
  ],
  relationships: [
    {
      title: 'Forgive One Another',
      reference: 'Colossians 3:13',
      text: 'Bear with each other and forgive one another if any of you has a grievance.',
      reflection:
        'Forgiveness opens space for healing.\nWho might God be asking you to release?\nGrace is a gift you can extend today.\nLet love lead your response.',
      prayer:
        'Jesus, give me grace to forgive as You forgive.\nHeal my relationships.',
    },
    {
      title: 'Love Is Patient',
      reference: '1 Corinthians 13:4-7',
      text: 'Love is patient, love is kind. It does not envy, it does not boast.',
      reflection:
        'Love is a daily choice, not just a feeling.\nWhere can you practice patience today?\nKindness reflects God’s heart to others.\nLet love guide your words.',
      prayer:
        'God, shape my heart with patient love.\nHelp me love like You do.',
    },
    {
      title: 'A Friend Loves At All Times',
      reference: 'Proverbs 17:17',
      text: 'A friend loves at all times, and a brother is born for a time of adversity.',
      reflection:
        'Faithful relationships grow through consistency.\nWho can you encourage today?\nSmall acts of care build lasting trust.\nBe present and steady.',
      prayer:
        'Lord, help me be a faithful friend today.\nTeach me to love with consistency.',
    },
    {
      title: 'Honor One Another',
      reference: 'Romans 12:10',
      text: 'Be devoted to one another in love. Honor one another above yourselves.',
      reflection:
        'Honor lifts others and reflects humility.\nHow can you serve someone today?\nDevotion in relationships mirrors Christ.\nChoose honor as your posture.',
      prayer:
        'Jesus, teach me to honor others well.\nMake me devoted in love.',
    },
  ],
  bible: [
    {
      title: 'Lamp To My Feet',
      reference: 'Psalm 119:105',
      text: 'Your word is a lamp for my feet, a light on my path.',
      reflection:
        'God’s Word brings clarity when life feels dim.\nRead slowly and let His guidance sink in.\nAsk for light on your next step.\nWalk forward with trust.',
      prayer:
        'God, light my path with Your Word.\nHelp me follow Your guidance today.',
    },
    {
      title: 'Meditate On The Word',
      reference: 'Joshua 1:8',
      text: 'Keep this Book of the Law always on your lips; meditate on it day and night.',
      reflection:
        'Meditation is more than reading; it is soaking.\nWhat phrase is God highlighting for you?\nLet it shape your day.\nFruit grows from steady intake.',
      prayer:
        'Lord, help me meditate on Your Word.\nLet it transform my thoughts today.',
    },
    {
      title: 'All Scripture Is God-Breathed',
      reference: '2 Timothy 3:16',
      text: 'All Scripture is God-breathed and useful for teaching, rebuking, correcting and training.',
      reflection:
        'God speaks through His Word with purpose.\nLet it teach and shape you today.\nReceive correction with humility.\nTrust its power to train you.',
      prayer:
        'God, breathe life into Your Word for me.\nShape me through it today.',
    },
    {
      title: 'The Word Is Alive',
      reference: 'Hebrews 4:12',
      text: 'The word of God is alive and active, sharper than any double-edged sword.',
      reflection:
        'Scripture is living and speaks into your present.\nLet it search your heart with grace.\nGod’s Word cuts through confusion.\nReceive it with openness.',
      prayer:
        'Father, let Your Word speak to my heart.\nMake me responsive to Your truth.',
    },
  ],
}

const focusAliases: Record<string, string> = {
  peace: 'peace',
  discipline: 'discipline',
  identity: 'identity',
  purpose: 'purpose',
  relationships: 'relationships',
  relationship: 'relationships',
  bible: 'bible',
  'understanding the bible': 'bible',
}

function getDateKey(dayOffset = 0): string {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + dayOffset)
  const dd = String(targetDate.getDate()).padStart(2, '0')
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
  const yyyy = targetDate.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647
  }
  return hash
}

export function getDailyWord(growthFocus?: string | null, dayOffset = 0): DailyWordEntry {
  const normalized = (growthFocus || '').trim().toLowerCase()
  const mapped = focusAliases[normalized] || 'peace'
  const pool = versePools[mapped] || versePools.peace
  const reflectionPromptByFocus: Record<string, string> = {
    peace: 'What is God inviting you to release today?',
    discipline: 'What step of obedience is God asking of you today?',
    identity: 'What does this passage reveal about who you are in Christ?',
    purpose: 'Where might God be directing your steps today?',
    relationships: 'Is there someone God is inviting you to love, forgive, or encourage today?',
    bible: 'What is God revealing about His truth through this passage today?',
  }
  const reflectionHelperByFocus: Record<string, string> = {
    peace: 'Take a quiet moment with God',
    discipline: 'Respond honestly and practically',
    identity: 'Let this shape how you see yourself',
    purpose: 'Pay attention to where God is leading',
    relationships: 'Reflect prayerfully on your connections',
    bible: 'Sit with what this passage reveals',
  }
  const reflectionPrompt = reflectionPromptByFocus[mapped] || reflectionPromptByFocus.peace
  const reflectionHelper = reflectionHelperByFocus[mapped] || reflectionHelperByFocus.peace
  const focusLabelByFocus: Record<string, string> = {
    peace: 'Peace',
    discipline: 'Discipline',
    identity: 'Identity',
    purpose: 'Purpose',
    relationships: 'Relationships',
    bible: 'Bible',
  }
  const focusLabel = focusLabelByFocus[mapped] || focusLabelByFocus.peace
  const dateKey = getDateKey(dayOffset)
  const index = hashString(`${mapped}-${dateKey}`) % pool.length
  return {
    ...pool[index],
    reflectionPrompt,
    reflectionHelper,
    focus: mapped,
    focusLabel,
  }
}
