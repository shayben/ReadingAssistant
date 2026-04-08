export interface DemoParagraph {
  title: string;
  text: string;
}

export interface ReadingLevel {
  grade: string;
  label: string;
  emoji: string;
  paragraphs: DemoParagraph[];
}

export const readingLevels: ReadingLevel[] = [
  {
    grade: 'K',
    label: 'Kindergarten',
    emoji: '🐣',
    paragraphs: [
      {
        title: 'The Big Cat',
        text: 'The cat sat on a mat. The cat is big. The cat is red. I like the cat.',
      },
      {
        title: 'My Dog',
        text: 'I have a dog. My dog can run. My dog can sit. I love my dog.',
      },
      {
        title: 'The Sun',
        text: 'The sun is hot. The sun is up. I can see the sun. It is a fun day.',
      },
    ],
  },
  {
    grade: '1',
    label: 'Grade 1',
    emoji: '🌱',
    paragraphs: [
      {
        title: 'At the Park',
        text: 'I went to the park with my mom. We played on the swings. I went down the slide. It was so much fun!',
      },
      {
        title: 'The Fish',
        text: 'I have a pet fish. It is blue and small. It swims in a tank. I feed it every day.',
      },
      {
        title: 'Rain Day',
        text: 'It is raining today. I can hear the rain on the roof. I will read a book and drink warm milk.',
      },
    ],
  },
  {
    grade: '2',
    label: 'Grade 2',
    emoji: '🌿',
    paragraphs: [
      {
        title: 'The Farm Visit',
        text: 'Last week we went to a farm. We saw cows, pigs, and chickens. The farmer let us feed the baby goats. They were soft and very friendly.',
      },
      {
        title: 'My Birthday',
        text: 'Yesterday was my birthday. I turned seven years old. My friends came to my party. We ate cake and played games outside.',
      },
      {
        title: 'The Library',
        text: 'I like going to the library. There are so many books to read. I picked a book about dinosaurs. Did you know some dinosaurs could fly?',
      },
    ],
  },
  {
    grade: '3',
    label: 'Grade 3',
    emoji: '🌳',
    paragraphs: [
      {
        title: 'The Solar System',
        text: 'Our solar system has eight planets. Earth is the third planet from the sun. Jupiter is the biggest planet. It would take over one thousand Earths to fill up Jupiter!',
      },
      {
        title: 'Making Pancakes',
        text: 'On Saturday morning, I helped my dad make pancakes. We mixed flour, eggs, and milk in a big bowl. Then we poured the batter on the hot pan. The pancakes were delicious with maple syrup.',
      },
      {
        title: 'The Treehouse',
        text: 'My grandfather helped me build a treehouse. We used wooden boards and nails. It has a small window and a rope ladder. I love sitting up there and watching the birds.',
      },
    ],
  },
  {
    grade: '4',
    label: 'Grade 4',
    emoji: '🌲',
    paragraphs: [
      {
        title: 'The Water Cycle',
        text: 'Water is always moving in a cycle. The sun heats water in oceans and lakes, turning it into vapor. The vapor rises and forms clouds. When the clouds get heavy, rain or snow falls back down to Earth. This process repeats over and over again.',
      },
      {
        title: 'Penguins',
        text: 'Penguins are interesting birds that cannot fly. Instead, they are excellent swimmers. Emperor penguins live in Antarctica where temperatures can drop below negative forty degrees. They huddle together in large groups to stay warm during terrible blizzards.',
      },
      {
        title: 'The Invention of Pizza',
        text: 'Pizza originally comes from Italy. In the late 1800s, a baker in Naples created a special pizza for the queen. He used tomatoes, mozzarella cheese, and basil to represent the Italian flag. Today, pizza is enjoyed by millions of people around the world.',
      },
    ],
  },
  {
    grade: '5',
    label: 'Grade 5',
    emoji: '🏔️',
    paragraphs: [
      {
        title: 'The Amazon Rainforest',
        text: 'The Amazon Rainforest is the largest tropical rainforest on Earth, covering over five million square kilometers. It produces approximately twenty percent of the world\'s oxygen and is home to countless species of plants and animals. Scientists estimate that millions of species living there have not yet been discovered.',
      },
      {
        title: 'Ancient Egypt',
        text: 'The ancient Egyptians built the pyramids over four thousand years ago. The Great Pyramid of Giza contains roughly two million stone blocks, each weighing about two and a half tons. Historians believe it took approximately twenty years and thousands of workers to complete this extraordinary structure.',
      },
      {
        title: 'Ocean Exploration',
        text: 'More than eighty percent of the ocean remains unexplored. The deepest point, the Mariana Trench, reaches nearly eleven kilometers below the surface. Remarkable creatures survive there despite crushing pressure and complete darkness. Scientists use specialized submarines to study these mysterious environments.',
      },
    ],
  },
  {
    grade: '6',
    label: 'Grade 6',
    emoji: '🗻',
    paragraphs: [
      {
        title: 'Photosynthesis',
        text: 'Photosynthesis is the remarkable process by which plants convert sunlight into energy. Chlorophyll, the green pigment in leaves, absorbs light and uses it to transform carbon dioxide and water into glucose and oxygen. This process is fundamental to life on Earth, as it provides the oxygen we breathe and forms the base of nearly every food chain in existence.',
      },
      {
        title: 'The Renaissance',
        text: 'The Renaissance was a period of extraordinary cultural and intellectual achievement that began in Italy during the fourteenth century. Artists like Leonardo da Vinci and Michelangelo revolutionized painting and sculpture. Meanwhile, scientists such as Galileo challenged traditional beliefs about the universe. This remarkable era transformed European civilization and continues to influence our world today.',
      },
      {
        title: 'Artificial Intelligence',
        text: 'Artificial intelligence refers to computer systems designed to perform tasks that typically require human intelligence. These systems can recognize speech, translate languages, and even make decisions. While artificial intelligence offers tremendous benefits in healthcare, education, and transportation, researchers emphasize the importance of developing these technologies responsibly and ethically.',
      },
    ],
  },
];
