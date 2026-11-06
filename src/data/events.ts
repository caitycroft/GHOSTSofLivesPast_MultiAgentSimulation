// The timeline the lives run through: macro, geopolitical, technology and
// culture events, plus the milestones of the life that happened. Each world
// event carries a receipt (a Wikipedia article checked by scripts/check-events.mjs).

export type EventKind = 'macro' | 'geo' | 'tech' | 'culture' | 'life'

export interface TimelineEvent {
  year: number
  month?: number
  kind: EventKind
  label: string // billboard length, a few words
  detail: string // one plain sentence
  wiki?: string // article title on en.wikipedia.org
}

export const EVENT_KINDS: { id: EventKind; label: string; color: string }[] = [
  { id: 'macro', label: 'Macroeconomy', color: '#ffd23d' },
  { id: 'geo', label: 'Geopolitics', color: '#ff6b6b' },
  { id: 'tech', label: 'Technology', color: '#38f3ff' },
  { id: 'culture', label: 'Culture and industry', color: '#ff5fd2' },
  { id: 'life', label: 'The life that happened', color: '#ffb36b' },
]

export const EVENTS: TimelineEvent[] = [
  // Macroeconomy
  { year: 2010, month: 5, kind: 'macro', label: 'Eurozone debt crisis', detail: 'Greece receives the first bailout and the euro crisis begins.', wiki: 'European_debt_crisis' },
  { year: 2010, month: 11, kind: 'macro', label: 'QE2', detail: 'The Federal Reserve starts a second round of quantitative easing; money stays nearly free.', wiki: 'Quantitative_easing' },
  { year: 2020, month: 3, kind: 'macro', label: 'Rates cut to zero', detail: 'Markets crash as the pandemic spreads and central banks cut rates to zero.', wiki: '2020_stock_market_crash' },
  { year: 2021, kind: 'macro', label: 'Record venture funding', detail: 'Venture investment hits an all time high on zero rates and stimulus.', wiki: 'Venture_capital' },
  { year: 2022, month: 3, kind: 'macro', label: 'Rate hikes begin', detail: 'Inflation surges and the Fed starts its fastest hiking cycle in decades.', wiki: '2021%E2%80%932023_inflation_surge' },
  { year: 2023, month: 3, kind: 'macro', label: 'SVB collapses', detail: 'Silicon Valley Bank fails, the largest US bank failure since 2008.', wiki: 'Collapse_of_Silicon_Valley_Bank' },
  { year: 2024, month: 9, kind: 'macro', label: 'Rate cuts begin', detail: 'The Fed starts cutting rates as inflation cools.', wiki: 'Federal_Reserve' },
  { year: 2025, month: 4, kind: 'macro', label: 'Tariff shock', detail: 'Sweeping US tariffs reset global trade and supply chains.', wiki: 'Liberation_Day_tariffs' },

  // Geopolitics
  { year: 2011, kind: 'geo', label: 'Arab Spring', detail: 'Protests organized on social media topple governments across the Arab world.', wiki: 'Arab_Spring' },
  { year: 2014, month: 3, kind: 'geo', label: 'Crimea annexed', detail: 'Russia annexes Crimea from Ukraine.', wiki: 'Annexation_of_Crimea_by_the_Russian_Federation' },
  { year: 2016, month: 6, kind: 'geo', label: 'Brexit vote', detail: 'The United Kingdom votes to leave the European Union.', wiki: '2016_United_Kingdom_European_Union_membership_referendum' },
  { year: 2016, month: 11, kind: 'geo', label: 'US election', detail: 'Donald Trump is elected US president.', wiki: '2016_United_States_presidential_election' },
  { year: 2018, kind: 'geo', label: 'US China trade war', detail: 'Tariffs between the two largest economies begin a long decoupling.', wiki: 'China%E2%80%93United_States_trade_war' },
  { year: 2022, month: 2, kind: 'geo', label: 'Ukraine invaded', detail: 'Russia launches a full scale invasion of Ukraine; energy prices spike across Europe.', wiki: 'Russian_invasion_of_Ukraine' },
  { year: 2023, month: 10, kind: 'geo', label: 'War in Gaza', detail: 'War between Israel and Hamas begins after the October 7 attacks.', wiki: 'Gaza_war' },
  { year: 2024, kind: 'geo', label: 'The election year', detail: 'Countries holding about half the world’s population vote in a single year.', wiki: 'List_of_elections_in_2024' },

  // Technology
  { year: 2010, month: 10, kind: 'tech', label: 'Instagram launches', detail: 'The camera becomes a social network.', wiki: 'Instagram' },
  { year: 2012, month: 8, kind: 'tech', label: 'Oculus Kickstarter', detail: 'A crowdfunded headset brings VR back.', wiki: 'Oculus_Rift' },
  { year: 2012, month: 9, kind: 'tech', label: 'AlexNet', detail: 'A neural network wins ImageNet and the deep learning era begins.', wiki: 'AlexNet' },
  { year: 2014, month: 3, kind: 'tech', label: 'Facebook buys Oculus', detail: 'A social network bets two billion dollars on virtual reality.', wiki: 'Oculus_VR' },
  { year: 2015, month: 7, kind: 'tech', label: 'Ethereum launches', detail: 'Programmable money goes live.', wiki: 'Ethereum' },
  { year: 2016, month: 3, kind: 'tech', label: 'AlphaGo', detail: 'DeepMind’s AlphaGo beats Lee Sedol at Go.', wiki: 'AlphaGo_versus_Lee_Sedol' },
  { year: 2017, month: 6, kind: 'tech', label: 'Transformers', detail: 'The paper Attention Is All You Need introduces the architecture behind modern AI.', wiki: 'Attention_Is_All_You_Need' },
  { year: 2018, month: 8, kind: 'tech', label: 'TikTok goes global', detail: 'Short video and the algorithmic feed take over.', wiki: 'TikTok' },
  { year: 2020, month: 6, kind: 'tech', label: 'GPT-3', detail: 'A language model writes convincing prose at scale.', wiki: 'GPT-3' },
  { year: 2021, month: 10, kind: 'tech', label: 'Facebook becomes Meta', detail: 'The metaverse becomes a company strategy.', wiki: 'Meta_Platforms' },
  { year: 2022, month: 11, kind: 'tech', label: 'ChatGPT', detail: 'A chatbot reaches a hundred million users in about two months.', wiki: 'ChatGPT' },
  { year: 2023, month: 8, kind: 'tech', label: 'Gaussian splatting', detail: 'A new way to capture real places as radiance fields renders in real time.', wiki: 'Gaussian_splatting' },
  { year: 2024, month: 2, kind: 'tech', label: 'Vision Pro ships', detail: 'Spatial computing reaches a mainstream platform.', wiki: 'Apple_Vision_Pro' },
  { year: 2025, kind: 'tech', label: 'Generated worlds', detail: 'World models start generating explorable 3D places from prompts and images.', wiki: 'Generative_artificial_intelligence' },

  // Culture and industry
  { year: 2011, month: 7, kind: 'culture', label: 'Spotify in the US', detail: 'Streaming arrives for American listeners.', wiki: 'Spotify' },
  { year: 2013, month: 2, kind: 'culture', label: 'House of Cards', detail: 'Netflix releases a whole season at once and the streaming originals era begins.', wiki: 'House_of_Cards_(American_TV_series)' },
  { year: 2013, month: 10, kind: 'culture', label: 'EDM goes public', detail: 'SFX Entertainment lists on the stock market, buying up festivals.', wiki: 'SFX_Entertainment' },
  { year: 2016, month: 2, kind: 'culture', label: 'Festival bust', detail: 'SFX Entertainment files for bankruptcy.', wiki: 'SFX_Entertainment' },
  { year: 2019, month: 11, kind: 'culture', label: 'Streaming wars', detail: 'Disney+ launches and every studio becomes a streamer.', wiki: 'Disney%2B' },
  { year: 2020, month: 3, kind: 'culture', label: 'Live music stops', detail: 'Tours and festivals worldwide are cancelled.', wiki: 'Impact_of_the_COVID-19_pandemic_on_the_music_industry' },
  { year: 2021, month: 3, kind: 'culture', label: 'The NFT sale', detail: 'A Beeple artwork sells as an NFT for 69 million dollars.', wiki: 'Everydays:_the_First_5000_Days' },
  { year: 2023, month: 5, kind: 'culture', label: 'Hollywood strikes', detail: 'Writers, then actors, strike over streaming pay and AI.', wiki: '2023_Writers_Guild_of_America_strike' },

  // The life that happened
  { year: 2010, kind: 'life', label: 'USC', detail: 'Starts at USC: Cinematic Arts, Narrative Studies, and a Photography minor.' },
  { year: 2012, kind: 'life', label: 'On the lot', detail: 'Interns at Warner Bros., De Line Pictures on the Warner Bros. lot, and MGM; DJs as Parker + Barrow.' },
  { year: 2014, kind: 'life', label: 'EDC on graduation day', detail: 'Graduates from USC and books EDC the same day.' },
  { year: 2015, kind: 'life', label: 'Burning Man, Lightning in a Bottle', detail: 'Plays Burning Man and Lightning in a Bottle; touring and producing, living between Los Angeles and Stockholm.' },
  { year: 2017, kind: 'life', label: 'Between LA and Stockholm', detail: 'Touring and producing, with trips to the High Coast, Mallorca and Utah.' },
  { year: 2020, kind: 'life', label: 'Into venture', detail: 'Moves into venture capital during COVID, living between Los Angeles, Hawaii and Utah.' },
  { year: 2022, kind: 'life', label: 'NYU ITP / IMA', detail: 'Starts the Interactive Telecommunications and Interactive Media Arts creative technology program in New York.' },
  { year: 2023, kind: 'life', label: 'London, Berlin, Oslo', detail: 'Stints in London, Berlin and Oslo during the program.' },
  { year: 2024, month: 4, kind: 'life', label: 'Svalbard Ski Marathon', detail: 'Skis the Svalbard Ski Marathon in the Arctic.' },
  { year: 2024, month: 6, kind: 'life', label: 'Graduates in Shanghai', detail: 'Graduates in Shanghai, then returns to Oslo.' },
  { year: 2025, kind: 'life', label: 'LA, New York, San Francisco', detail: 'Back between Los Angeles, New York and San Francisco, building spatial worlds and music.' },
]

export const wikiLink = (title: string) => `https://en.wikipedia.org/wiki/${title}`
export const eventsIn = (year: number) => EVENTS.filter((e) => e.year === year)
