// 박종권 식단표 + 추가 음식 카탈로그. 1인분 기준 영양값.

export interface FoodItem {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  category: string
}

export const FOOD_CATEGORIES = ['단백질', '주식', '채소', '과일', '견과·유지', '유제품', '음료', '반찬', '간식', '기타'] as const

export const FOODS: FoodItem[] = [
  // 아침
  { id: 'greek-yogurt',     name: '그릭요거트',                kcal: 100, protein: 10, carbs: 6,  fat: 4,  category: '유제품' },
  { id: 'apple',            name: '사과 1개',                  kcal: 95,  protein: 0,  carbs: 25, fat: 0,  category: '과일' },
  { id: 'banana',           name: '바나나 1개',                kcal: 90,  protein: 1,  carbs: 23, fat: 0,  category: '과일' },
  { id: 'oatmeal-60g',      name: '오트밀 60g',                kcal: 220, protein: 8,  carbs: 38, fat: 4,  category: '주식' },
  { id: 'boiled-egg',       name: '삶은 계란 1개',             kcal: 78,  protein: 6,  carbs: 1,  fat: 5,  category: '단백질' },
  { id: 'boiled-egg-2',     name: '삶은 계란 2개',             kcal: 156, protein: 12, carbs: 2,  fat: 10, category: '단백질' },
  { id: 'boiled-egg-3',     name: '삶은 계란 3개',             kcal: 234, protein: 18, carbs: 3,  fat: 15, category: '단백질' },
  { id: 'olive-lemon',      name: '올리브유+레몬즙 1큰술',     kcal: 120, protein: 0,  carbs: 1,  fat: 14, category: '견과·유지' },
  { id: 'almond-14',        name: '아몬드 14알',               kcal: 100, protein: 4,  carbs: 3,  fat: 9,  category: '견과·유지' },
  { id: 'veggie-salad',     name: '야채샐러드 (드레싱 제외)',  kcal: 80,  protein: 3,  carbs: 12, fat: 2,  category: '채소' },

  // 외식·식당 (점심 위주, 평균 1인분 기준)
  { id: 'school-meal',      name: '학식 한 끼 (평균)',           kcal: 750, protein: 25, carbs: 100, fat: 22, category: '기타' },
  { id: 'cafeteria-meal',   name: '구내식당 한 끼 (평균)',       kcal: 800, protein: 28, carbs: 105, fat: 24, category: '기타' },
  { id: 'baekban',          name: '백반 한 정식 (평균)',         kcal: 850, protein: 25, carbs: 110, fat: 28, category: '기타' },
  { id: 'bibimbap',         name: '비빔밥 1인분',                kcal: 700, protein: 20, carbs: 95,  fat: 20, category: '기타' },
  { id: 'kimchi-stew',      name: '김치찌개 백반 1인분',         kcal: 700, protein: 22, carbs: 80,  fat: 26, category: '기타' },
  { id: 'salady-grain-wrap',name: '샐러디 곡물랩 (평균)',        kcal: 480, protein: 26, carbs: 48, fat: 20, category: '기타' },
  { id: 'salady-poke',      name: '샐러디 포케 (평균)',          kcal: 520, protein: 30, carbs: 60, fat: 14, category: '기타' },
  { id: 'salady-chicken-bowl', name: '샐러디 닭가슴살 보울',     kcal: 450, protein: 35, carbs: 40, fat: 14, category: '기타' },
  { id: 'subway-chicken',   name: '서브웨이 치킨샌드 (15cm)',    kcal: 420, protein: 23, carbs: 50, fat: 14, category: '기타' },
  { id: 'salad-poke-bowl',  name: '연어 포케 1인분',             kcal: 550, protein: 28, carbs: 60, fat: 20, category: '기타' },
  { id: 'salad-bowl',       name: '닭가슴살 샐러드볼 (평균)',    kcal: 420, protein: 32, carbs: 28, fat: 18, category: '기타' },

  // 점심·저녁 단백질
  { id: 'chicken-breast-100', name: '닭가슴살 100g',           kcal: 165, protein: 31, carbs: 0,  fat: 4,  category: '단백질' },
  { id: 'chicken-breast-200', name: '닭가슴살 200g',           kcal: 330, protein: 62, carbs: 0,  fat: 8,  category: '단백질' },
  { id: 'tuna-can-small',   name: '참치 작은 캔 (85g)',        kcal: 110, protein: 24, carbs: 0,  fat: 1,  category: '단백질' },
  { id: 'tofu-half',        name: '두부구이 1/2모 (150g)',     kcal: 150, protein: 15, carbs: 4,  fat: 8,  category: '단백질' },
  { id: 'mackerel-grilled', name: '고등어구이 1마리 (150g)',   kcal: 380, protein: 30, carbs: 0,  fat: 28, category: '단백질' },
  { id: 'beef-lowfat-200',  name: '소고기 저지방부위 200g',    kcal: 280, protein: 40, carbs: 0,  fat: 12, category: '단백질' },

  // 주식·탄수
  { id: 'sweet-potato-200', name: '밤고구마 200g',             kcal: 240, protein: 3,  carbs: 56, fat: 0,  category: '주식' },
  { id: 'brown-rice-210',   name: '현미 or 잡곡밥 210g',       kcal: 310, protein: 7,  carbs: 66, fat: 2,  category: '주식' },
  { id: 'pumpkin-half',     name: '단호박 2/4쪽 (~200g)',      kcal: 80,  protein: 2,  carbs: 20, fat: 0,  category: '주식' },
  { id: 'soy-egg-rice',     name: '간장계란밥 (밥 210g + 계란 3개 + 간장)', kcal: 580, protein: 22, carbs: 68, fat: 22, category: '주식' },

  // 채소
  { id: 'cabbage-steamed',  name: '데친 양배추 100g',          kcal: 25,  protein: 1,  carbs: 5,  fat: 0,  category: '채소' },
  { id: 'broccoli-100',     name: '브로콜리 100g',             kcal: 35,  protein: 3,  carbs: 7,  fat: 0,  category: '채소' },
  { id: 'cucumber-pepper',  name: '오이고추 5개',              kcal: 15,  protein: 1,  carbs: 3,  fat: 0,  category: '채소' },
  { id: 'cherry-tomato',    name: '방울토마토 10알',           kcal: 30,  protein: 1,  carbs: 7,  fat: 0,  category: '채소' },
  { id: 'mushroom-grilled', name: '버섯 구이 100g',            kcal: 30,  protein: 3,  carbs: 5,  fat: 0,  category: '채소' },
  { id: 'ssam-vegetables',  name: '쌈 야채 한 줌',             kcal: 15,  protein: 1,  carbs: 3,  fat: 0,  category: '채소' },

  // 음료·간식
  { id: 'wing-shake',       name: '윙쉐이크',                  kcal: 150, protein: 25, carbs: 5,  fat: 2,  category: '음료' },
  { id: 'soy-milk',         name: '두유 190ml',                kcal: 90,  protein: 5,  carbs: 8,  fat: 4,  category: '음료' },
  { id: 'black-soy-milk',   name: '무당 검은콩 두유 190ml',    kcal: 80,  protein: 6,  carbs: 5,  fat: 4,  category: '음료' },
  { id: 'energy-bar',       name: '에너지바 1개',              kcal: 180, protein: 5,  carbs: 25, fat: 7,  category: '간식' },

  // 반찬
  { id: 'gim',              name: '김 1봉 (2g)',               kcal: 10,  protein: 1,  carbs: 1,  fat: 0,  category: '반찬' },
  { id: 'kimchi-50',        name: '김치 50g',                  kcal: 15,  protein: 1,  carbs: 3,  fat: 0,  category: '반찬' },
]
