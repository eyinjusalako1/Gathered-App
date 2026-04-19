export interface FocusTag {
  value: string
  label: string
  emoji: string
  nameSuggestions: string[]
  descriptionStarters: string[]
}

export const FOCUS_TAGS: FocusTag[] = [
  {
    value: 'bible-study',
    label: 'Bible Study',
    emoji: '📖',
    nameSuggestions: [
      'The Word Collective',
      'Dig Deeper Bible Study',
      'Scripture & Community',
      'Open Bible Fellowship',
      'Rooted in the Word',
    ],
    descriptionStarters: [
      'We gather weekly to study Scripture together — no prior knowledge needed, just an open heart.',
      'A Bible study group for anyone wanting to go deeper into God\'s Word in a relaxed, honest setting.',
      'We read through books of the Bible together, share what God is saying to us, and grow as a community.',
    ],
  },
  {
    value: 'prayer',
    label: 'Prayer',
    emoji: '🙏',
    nameSuggestions: [
      'The Upper Room',
      'Prayer Collective',
      'Together in Prayer',
      'The Watch',
      'Standing in the Gap',
    ],
    descriptionStarters: [
      'We meet to pray together — for each other, our communities, and the world around us.',
      'A safe, welcoming space to bring your needs before God alongside others who care.',
      'We believe in the power of gathered prayer. Come as you are — no experience required.',
    ],
  },
  {
    value: 'mens-group',
    label: "Men's Group",
    emoji: '🧔',
    nameSuggestions: [
      'Brothers in Faith',
      'Iron & Fire',
      'The Brotherhood',
      'Men of Purpose',
      'Faithful Men UK',
    ],
    descriptionStarters: [
      'A space for men to be honest, be challenged, and grow together in faith.',
      'We talk about the stuff men rarely talk about — faith, family, work, and what it means to follow Jesus.',
      'Brotherhood, accountability, and genuine community for men at any stage of their walk with God.',
    ],
  },
  {
    value: 'womens-group',
    label: "Women's Group",
    emoji: '👩',
    nameSuggestions: [
      'Sisters in Faith',
      'Women of Grace',
      'The Well',
      'Rooted Women',
      'Flourish Collective',
    ],
    descriptionStarters: [
      'A warm, honest community for women to encourage one another and grow in faith.',
      'We meet to share life, study the Word, and remind each other of who God says we are.',
      'A space where women can be real — about their faith, their struggles, and their hope.',
    ],
  },
  {
    value: 'young-adults',
    label: 'Young Adults',
    emoji: '✨',
    nameSuggestions: [
      'The Collective',
      'Young & Rooted',
      'Next Gen Faith',
      'The Living Room',
      'Twenties & Thirties',
    ],
    descriptionStarters: [
      'A community for 18–35s navigating faith, work, relationships, and life together.',
      'Real conversations, genuine friendships, and growing faith — for young adults who want more than Sunday service.',
      'We\'re figuring out what it means to follow Jesus in our twenties and thirties. You\'re not alone.',
    ],
  },
  {
    value: 'couples',
    label: 'Couples',
    emoji: '💑',
    nameSuggestions: [
      'Covenant Couples',
      'Together in Faith',
      'Two by Two',
      'Rooted Together',
      'The Marriage Table',
    ],
    descriptionStarters: [
      'A community for couples to grow together in faith, support one another, and build lasting friendships.',
      'We believe strong marriages need a strong community. Join us as we invest in our relationships and our faith.',
      'For couples at any stage — dating, newly married, or decades in. Come as you are.',
    ],
  },
  {
    value: 'accountability',
    label: 'Accountability',
    emoji: '🤝',
    nameSuggestions: [
      'The Inner Circle',
      'Sharpening Iron',
      'Faithful & Honest',
      'The Core',
      'Walk Together',
    ],
    descriptionStarters: [
      'A small, trusted group for people serious about growing — and serious about keeping each other accountable.',
      'We check in, challenge each other, pray honestly, and grow. No hiding here.',
      'Real accountability in a safe space. We walk alongside each other through the highs and the hard days.',
    ],
  },
  {
    value: 'worship',
    label: 'Worship',
    emoji: '🎵',
    nameSuggestions: [
      'Worship Collective',
      'Sound of Heaven',
      'The Sanctuary',
      'Lifted Hearts',
      'New Song Community',
    ],
    descriptionStarters: [
      'A community of worshippers who love to encounter God through music, prayer, and praise.',
      'Whether you play, sing, or just love to worship — come and meet others who do too.',
      'We gather to worship, to grow as musicians and worshippers, and to serve our local church.',
    ],
  },
  {
    value: 'social-community',
    label: 'Social & Community',
    emoji: '☕',
    nameSuggestions: [
      'Faith & Friends',
      'The Gathering Place',
      'Community Corner',
      'Connexion',
      'The Table',
    ],
    descriptionStarters: [
      'A friendly, relaxed group for Christians who want genuine community without the pressure.',
      'We meet, eat, laugh, and look out for each other. Faith-filled friendship, simply.',
      'Fellowship doesn\'t have to be formal. Come hang out, be yourself, and belong somewhere.',
    ],
  },
  {
    value: 'missions-outreach',
    label: 'Missions & Outreach',
    emoji: '🌍',
    nameSuggestions: [
      'Go & Serve',
      'Kingdom Builders',
      'The Sent Ones',
      'Outreach Collective',
      'Love in Action',
    ],
    descriptionStarters: [
      'We\'re passionate about serving our city and reaching those who need to know Jesus.',
      'A community for people who want their faith to be more than Sunday — let\'s go serve together.',
      'From street outreach to community projects, we go where the need is. Come join us.',
    ],
  },
  {
    value: 'new-believers',
    label: 'New Believers',
    emoji: '🌱',
    nameSuggestions: [
      'First Steps',
      'New Roots',
      'Starting Out',
      'New Life Community',
      'Fresh Start Faith',
    ],
    descriptionStarters: [
      'A gentle, welcoming space for people who are new to faith or just starting to explore Christianity.',
      'No question is too basic here. We help new believers take their first steps with confidence.',
      'Started your faith journey recently? Come and grow alongside others who know what it\'s like to be new.',
    ],
  },
  {
    value: 'mental-health-faith',
    label: 'Mental Health & Faith',
    emoji: '💚',
    nameSuggestions: [
      'Whole & Held',
      'Still Waters',
      'Hope & Healing',
      'The Safe Space',
      'Faith Through the Storm',
    ],
    descriptionStarters: [
      'A safe, supportive space where faith and mental health walk hand in hand — no shame, no stigma.',
      'We believe God meets us in our struggles. Come as you are, and let\'s walk through it together.',
      'For anyone navigating anxiety, depression, or burnout alongside their faith. You don\'t have to do this alone.',
    ],
  },
]

export function getTagByValue(value: string): FocusTag | undefined {
  return FOCUS_TAGS.find(t => t.value === value)
}

export function getNameSuggestionsForTags(tagValues: string[]): string[] {
  const seen = new Set<string>()
  const suggestions: string[] = []
  for (const value of tagValues) {
    const tag = getTagByValue(value)
    if (tag) {
      for (const name of tag.nameSuggestions) {
        if (!seen.has(name)) {
          seen.add(name)
          suggestions.push(name)
        }
      }
    }
  }
  return suggestions.slice(0, 6)
}

export function getDescriptionStartersForTags(tagValues: string[]): string[] {
  const seen = new Set<string>()
  const starters: string[] = []
  for (const value of tagValues) {
    const tag = getTagByValue(value)
    if (tag) {
      for (const starter of tag.descriptionStarters) {
        if (!seen.has(starter)) {
          seen.add(starter)
          starters.push(starter)
        }
      }
    }
  }
  return starters.slice(0, 4)
}
