import { User, Topic, Comment, Message, Location } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Alex Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=256&q=80',
  },
  {
    id: '2',
    name: 'Taylor Kim',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=256&q=80',
  },
  {
    id: '3',
    name: 'Jamie Wong',
    avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=256&q=80',
  },
  {
    id: '4',
    name: 'Morgan Lee',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=256&q=80',
  },
  {
    id: '5',
    name: 'Casey Park',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=256&q=80',
  },
];

export const mockLocations: Location[] = [
  {
    latitude: 35.6812,
    longitude: 139.7671,
    name: "Shibuya Crossing",
    address: "Shibuya, Tokyo, Japan"
  },
  {
    latitude: 35.6586,
    longitude: 139.7454,
    name: "Roppongi Hills",
    address: "Roppongi, Tokyo, Japan"
  },
  {
    latitude: 35.7101,
    longitude: 139.8107,
    name: "Tokyo Skytree",
    address: "Sumida, Tokyo, Japan"
  },
  {
    latitude: 35.6432,
    longitude: 139.6729,
    name: "Shimokitazawa",
    address: "Setagaya, Tokyo, Japan"
  },
  {
    latitude: 35.7100,
    longitude: 139.8132,
    name: "Asakusa",
    address: "Taito, Tokyo, Japan"
  }
];

export const mockTopics: Topic[] = [
  {
    id: '1',
    title: "Best ramen spots in the area?",
    description: "Looking for authentic ramen recommendations within walking distance. Any hidden gems?",
    createdAt: "2025-07-02T15:30:00Z",
    author: mockUsers[0],
    location: mockLocations[0],
    distance: 120,
    commentCount: 8,
    participantCount: 12
  },
  {
    id: '2',
    title: "Weekend street festival - anyone going?",
    description: "There's a street festival this weekend with food stalls and live music. Who's planning to attend?",
    createdAt: "2025-07-02T14:15:00Z",
    author: mockUsers[1],
    location: mockLocations[1],
    distance: 350,
    commentCount: 15,
    participantCount: 24
  },
  {
    id: '3',
    title: "Power outage in north district?",
    description: "Is anyone else experiencing a power outage in the north district? Any info on when it might be fixed?",
    createdAt: "2025-07-02T16:45:00Z",
    author: mockUsers[2],
    location: mockLocations[2],
    distance: 780,
    commentCount: 32,
    participantCount: 45
  },
  {
    id: '4',
    title: "New coffee shop opening - free samples!",
    description: "The new artisan coffee shop is giving out free samples today until 5pm. Just tried it and it's amazing!",
    createdAt: "2025-07-02T10:20:00Z",
    author: mockUsers[3],
    location: mockLocations[3],
    distance: 450,
    commentCount: 7,
    participantCount: 9
  },
  {
    id: '5',
    title: "Lost cat near central park - please help",
    description: "My orange tabby cat went missing near the central park area. Responds to 'Milo'. Please message if spotted!",
    createdAt: "2025-07-02T09:10:00Z",
    author: mockUsers[4],
    location: mockLocations[4],
    distance: 1200,
    commentCount: 18,
    participantCount: 22
  },
  {
    id: '6',
    title: "Train delays on JR line",
    description: "Experiencing major delays on the JR Yamanote line due to signal issues. Use alternative routes if possible.",
    createdAt: "2025-07-02T08:30:00Z",
    author: mockUsers[0],
    location: mockLocations[0],
    distance: 200,
    commentCount: 12,
    participantCount: 35
  },
  {
    id: '7',
    title: "Casual meetup at park",
    description: "Anyone free this evening for a casual meetup at the park? Bringing frisbee and snacks!",
    createdAt: "2025-07-02T12:00:00Z",
    author: mockUsers[1],
    location: mockLocations[1],
    distance: 600,
    commentCount: 5,
    participantCount: 8
  },
  {
    id: '8',
    title: "Food truck festival this weekend",
    description: "Amazing food truck festival with international cuisine. Over 20 different vendors!",
    createdAt: "2025-07-02T13:20:00Z",
    author: mockUsers[2],
    location: mockLocations[2],
    distance: 900,
    commentCount: 20,
    participantCount: 42
  }
];

export const mockComments: Comment[] = [
  {
    id: '1',
    text: "Ichiran is always solid, but there's a small place called Menya Sho two blocks east that's incredible!",
    createdAt: "2025-07-02T16:10:00Z",
    author: mockUsers[1],
    likes: 5,
    topicId: '1'
  },
  {
    id: '2',
    text: "I second Menya Sho! Their spicy miso ramen is the best I've had in the area.",
    createdAt: "2025-07-02T16:25:00Z",
    author: mockUsers[2],
    likes: 3,
    topicId: '1'
  },
  {
    id: '3',
    text: "I'll be there around 2pm with some friends. Look for us near the main stage!",
    createdAt: "2025-07-02T14:30:00Z",
    author: mockUsers[0],
    likes: 2,
    topicId: '2'
  },
  {
    id: '4',
    text: "Yes, our whole block is out. The utility company website says it should be restored by 8pm.",
    createdAt: "2025-07-02T17:00:00Z",
    author: mockUsers[3],
    likes: 8,
    topicId: '3'
  },
  {
    id: '5',
    text: "Just got their mocha latte - it's amazing! They're also giving out pastry samples.",
    createdAt: "2025-07-02T11:45:00Z",
    author: mockUsers[4],
    likes: 4,
    topicId: '4'
  }
];

export const mockMessages: Message[] = [
  {
    id: '1',
    text: "Has anyone tried the tonkotsu at Menya Sho?",
    createdAt: "2025-07-02T16:30:00Z",
    author: mockUsers[0],
    topicId: '1'
  },
  {
    id: '2',
    text: "Yes! It's rich and creamy, definitely worth trying.",
    createdAt: "2025-07-02T16:32:00Z",
    author: mockUsers[1],
    topicId: '1'
  },
  {
    id: '3',
    text: "I prefer their shoyu ramen personally, but tonkotsu is their specialty.",
    createdAt: "2025-07-02T16:35:00Z",
    author: mockUsers[2],
    topicId: '1'
  },
  {
    id: '4',
    text: "Do they have vegetarian options?",
    createdAt: "2025-07-02T16:40:00Z",
    author: mockUsers[3],
    topicId: '1'
  },
  {
    id: '5',
    text: "Yes, they have a great mushroom-based ramen that's vegetarian!",
    createdAt: "2025-07-02T16:42:00Z",
    author: mockUsers[4],
    topicId: '1'
  }
];