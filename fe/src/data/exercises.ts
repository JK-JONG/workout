// 박종권 4분할 + 추가 운동 카탈로그. BE 제거 후 단일 SSOT.
// MET = Compendium of Physical Activities 근사값.

export type ExerciseUnit = 'reps' | 'time' | 'distance'
export type Routine = '등&삼두' | '하체&이두' | '가슴&복근' | '어깨&삼두'

export interface ExerciseItem {
  id: string
  name: string
  category: string
  equipment: '바벨' | '덤벨' | '머신' | '케이블' | '맨몸' | '유산소기구'
  met: number
  unit: ExerciseUnit
  duration_per_set?: number
  routine?: Routine
  order_no?: number
  body_part?: string
  note?: string
  search_en?: string
  image_url?: string
}

export const ROUTINES: Routine[] = ['등&삼두', '하체&이두', '가슴&복근', '어깨&삼두']

const IMG = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/'

export const EXERCISES: ExerciseItem[] = [
  // ── 등 & 삼두 ──
  { id: 'cable-arm-pulldown',  name: '케이블 암 풀 다운',        category: '등',   equipment: '케이블', met: 5.0, unit: 'reps', duration_per_set: 0.7, routine: '등&삼두', order_no: 1, body_part: '광배근',                      search_en: 'cable straight arm pulldown', image_url: IMG + '0238-x69MAlq.gif' },
  { id: 'lat-pulldown',        name: '렛 풀 다운',               category: '등',   equipment: '머신',   met: 5.0, unit: 'reps', duration_per_set: 0.7, routine: '등&삼두', order_no: 2, body_part: '광배근, 하부승모근',          search_en: 'lat pulldown', image_url: IMG + '0198-RVwzP10.gif' },
  { id: 'seated-row',          name: '시티드 로우',              category: '등',   equipment: '머신',   met: 5.0, unit: 'reps', duration_per_set: 0.7, routine: '등&삼두', order_no: 3, body_part: '중·하부승모근, 광배근',       search_en: 'cable seated row', image_url: IMG + '0861-fUBheHs.gif' },
  { id: 'one-arm-db-row',      name: '원 암 덤벨 로우',          category: '등',   equipment: '덤벨',   met: 5.0, unit: 'reps', duration_per_set: 0.8, routine: '등&삼두', order_no: 4, body_part: '광배근, 중·하부승모근',       search_en: 'one arm dumbbell row', image_url: IMG + '0292-C0MA9bC.gif' },
  { id: 'cable-pushdown',      name: '케이블 푸쉬 다운',         category: '팔',   equipment: '케이블', met: 4.5, unit: 'reps', duration_per_set: 0.6, routine: '등&삼두', order_no: 5, body_part: '삼두근',                       search_en: 'cable triceps pushdown', image_url: IMG + '0241-gAwDzB3.gif' },
  { id: 'lying-tricep-ext-bs', name: '라잉 트라이셉스 익스텐션', category: '팔',   equipment: '덤벨',   met: 4.5, unit: 'reps', duration_per_set: 0.6, routine: '등&삼두', order_no: 6, body_part: '삼두근',                       search_en: 'lying triceps extension', image_url: IMG + '0061-iZop9xO.gif' },
  { id: 'crunch-25x3',         name: '크런치',                   category: '복근', equipment: '맨몸',   met: 3.8, unit: 'reps', duration_per_set: 0.5, routine: '등&삼두', order_no: 7, body_part: '복직근', note: '25회 3세트', search_en: 'crunch', image_url: IMG + '0274-TFqbd8t.gif' },

  // ── 하체 & 이두 ──
  { id: 'inner-thigh',         name: '이너타이',                 category: '하체', equipment: '머신',   met: 4.5, unit: 'reps', duration_per_set: 0.6, routine: '하체&이두', order_no: 1, body_part: '내전근',                search_en: 'hip adduction', image_url: IMG + '0598-oHsrypV.gif' },
  { id: 'leg-extension',       name: '레그 익스텐션',            category: '하체', equipment: '머신',   met: 5.0, unit: 'reps', duration_per_set: 0.7, routine: '하체&이두', order_no: 2, body_part: '대퇴사두근',            search_en: 'leg extension', image_url: IMG + '0585-my33uHU.gif' },
  { id: 'db-lunge-smith-squat', name: '덤벨 런지 or 스미스머신 스쿼트', category: '하체', equipment: '덤벨', met: 6.0, unit: 'reps', duration_per_set: 0.8, routine: '하체&이두', order_no: 3, body_part: '대퇴사두, 대둔근', search_en: 'dumbbell lunge / smith squat', image_url: IMG + '0336-RRWFUcw.gif' },
  { id: 'power-leg-press',     name: '파워 레그 프레스',         category: '하체', equipment: '머신',   met: 6.0, unit: 'reps', duration_per_set: 0.8, routine: '하체&이두', order_no: 4, body_part: '대퇴사두근',            search_en: 'leg press', image_url: IMG + '1463-2Qh2J1e.gif' },
  { id: 'leg-curl',            name: '레그 컬',                  category: '하체', equipment: '머신',   met: 5.0, unit: 'reps', duration_per_set: 0.7, routine: '하체&이두', order_no: 5, body_part: '햄스트링, 대둔근',      search_en: 'lying leg curl', image_url: IMG + '0586-17lJ1kr.gif' },
  { id: 'barbell-curl',        name: '바벨 컬',                  category: '팔',   equipment: '바벨',   met: 4.0, unit: 'reps', duration_per_set: 0.5, routine: '하체&이두', order_no: 6, body_part: '상완이두근',            search_en: 'barbell curl', image_url: IMG + '0031-25GPyDY.gif' },
  { id: 'db-curl-hammer',      name: '덤벨 컬 or 덤벨 해머 컬',  category: '팔',   equipment: '덤벨',   met: 4.0, unit: 'reps', duration_per_set: 0.5, routine: '하체&이두', order_no: 7, body_part: '상완이두근, 상완요골근', search_en: 'dumbbell hammer curl', image_url: IMG + '0313-slDvUAU.gif' },

  // ── 가슴 & 복근 ──
  { id: 'cable-fly',           name: '케이블 플라이',            category: '가슴', equipment: '케이블', met: 5.0, unit: 'reps', duration_per_set: 0.7, routine: '가슴&복근', order_no: 1, body_part: '대흉근',                search_en: 'cable fly', image_url: IMG + '0227-Pr9Rhf4.gif' },
  { id: 'incline-bench',       name: '인클라인 벤치프레스 or 스미스 인클라인 프레스', category: '가슴', equipment: '바벨', met: 6.0, unit: 'reps', duration_per_set: 0.8, routine: '가슴&복근', order_no: 2, body_part: '대흉근 상부, 삼각근, 삼두근', search_en: 'incline bench press', image_url: IMG + '0047-3TZduzM.gif' },
  { id: 'bench-press',         name: '벤치프레스',               category: '가슴', equipment: '바벨',   met: 6.0, unit: 'reps', duration_per_set: 0.8, routine: '가슴&복근', order_no: 3, body_part: '대흉근, 삼각근, 삼두근', search_en: 'bench press', image_url: IMG + '0025-EIeI8Vf.gif' },
  { id: 'pushup',              name: '푸쉬업',                   category: '가슴', equipment: '맨몸',   met: 8.0, unit: 'reps', duration_per_set: 0.5, routine: '가슴&복근', order_no: 4, body_part: '대흉근, 삼각근, 삼두근', search_en: 'push-up', image_url: IMG + '0662-I4hDWkc.gif' },
  { id: 'leg-raise-20x3',      name: '레그레이즈',               category: '복근', equipment: '맨몸',   met: 4.0, unit: 'reps', duration_per_set: 0.5, routine: '가슴&복근', order_no: 5, body_part: '복직근 하부', note: '20회 3세트', search_en: 'lying leg raise', image_url: IMG + '0620-WhuFnR7.gif' },
  { id: 'side-crunch-20x3',    name: '사이드 크런치',            category: '복근', equipment: '맨몸',   met: 3.8, unit: 'reps', duration_per_set: 0.5, routine: '가슴&복근', order_no: 6, body_part: '복사근', note: '20회 3세트', search_en: 'oblique crunch', image_url: IMG + '0635-QUDd8WS.gif' },

  // ── 어깨 & 삼두 ──
  { id: 'reverse-pec-deck',    name: '리버스 펙 덱 플라이',      category: '어깨', equipment: '머신',   met: 4.5, unit: 'reps', duration_per_set: 0.6, routine: '어깨&삼두', order_no: 1, body_part: '후면 삼각근',           search_en: 'reverse pec deck fly', image_url: IMG + '0602-myfUsKf.gif' },
  { id: 'barbell-military',    name: '바벨 밀리터리 프레스',     category: '어깨', equipment: '바벨',   met: 6.0, unit: 'reps', duration_per_set: 0.8, routine: '어깨&삼두', order_no: 2, body_part: '전·측면 삼각근, 삼두근', search_en: 'barbell military press', image_url: IMG + '1456-wdRZISl.gif' },
  { id: 'db-shoulder-press',   name: '덤벨 숄더 프레스',         category: '어깨', equipment: '덤벨',   met: 5.5, unit: 'reps', duration_per_set: 0.7, routine: '어깨&삼두', order_no: 3, body_part: '측면 삼각근, 삼두근',    search_en: 'dumbbell shoulder press', image_url: IMG + '0405-znQUdHY.gif' },
  { id: 'lateral-front-raise', name: '사이드 레터럴 레이즈 or 프론트 레이즈', category: '어깨', equipment: '덤벨', met: 4.5, unit: 'reps', duration_per_set: 0.6, routine: '어깨&삼두', order_no: 4, body_part: '측면 / 전면 삼각근', search_en: 'lateral raise', image_url: IMG + '0334-DsgkuIt.gif' },
  { id: 'pushdown-overhead-ext', name: '케이블 푸쉬다운 + 케이블 오버헤드 익스텐션', category: '팔', equipment: '케이블', met: 4.5, unit: 'reps', duration_per_set: 0.7, routine: '어깨&삼두', order_no: 5, body_part: '삼두근', search_en: 'cable triceps overhead extension', image_url: IMG + '0194-2IxROQ1.gif' },
  { id: 'lying-tricep-ext-st', name: '라잉 트라이셉스 익스텐션', category: '팔',   equipment: '덤벨',   met: 4.5, unit: 'reps', duration_per_set: 0.6, routine: '어깨&삼두', order_no: 6, body_part: '삼두근',                search_en: 'dumbbell lying triceps extension', image_url: IMG + '0351-mpKZGWz.gif' },

  // ── 유산소 ──
  { id: 'running',             name: '달리기',                   category: '유산소', equipment: '유산소기구', met: 9.0, unit: 'distance', search_en: 'running', image_url: IMG + '0684-y5p0H8a.gif' },
  { id: 'cycling',             name: '실내 사이클',              category: '유산소', equipment: '유산소기구', met: 6.8, unit: 'time', search_en: 'stationary cycling', image_url: IMG + '2138-H1PESYI.gif' },
  { id: 'walking',             name: '걷기',                     category: '유산소', equipment: '맨몸',        met: 3.5, unit: 'time', search_en: 'walking', image_url: IMG + '3666-rjiM4L3.gif' },
  { id: 'stepmill',            name: '천국의 계단',              category: '유산소', equipment: '유산소기구',  met: 8.8, unit: 'time', search_en: 'stepmill / stairmaster', image_url: IMG + '2311-j9Q5crt.gif' },
  { id: 'incline-run',         name: '인클라인 달리기 (경사 트레드밀)', category: '유산소', equipment: '유산소기구',  met: 10.0, unit: 'time', search_en: 'incline treadmill run', image_url: IMG + '3666-rjiM4L3.gif' },

  // ── 박종권 루틴 외 추가 (routine 없음) ──
  { id: 'db-bench-press',      name: '덤벨 벤치프레스',          category: '가슴', equipment: '덤벨',   met: 6.0, unit: 'reps', duration_per_set: 0.7, body_part: '대흉근, 삼두근, 삼각근',       search_en: 'dumbbell bench press',            image_url: IMG + '0289-SpYC0Kp.gif' },
  { id: 'db-incline-bench',    name: '덤벨 인클라인 프레스',     category: '가슴', equipment: '덤벨',   met: 6.0, unit: 'reps', duration_per_set: 0.7, body_part: '대흉근 상부, 삼두근',          search_en: 'dumbbell incline bench press',    image_url: IMG + '0314-ns0SIbU.gif' },
  { id: 'chest-dip',           name: '체스트 딥스',              category: '가슴', equipment: '맨몸',   met: 8.0, unit: 'reps', duration_per_set: 0.7, body_part: '대흉근 하부, 삼두근',          search_en: 'chest dip',                       image_url: IMG + '0251-9WTm7dq.gif' },
  { id: 'machine-chest-press', name: '머신 체스트 프레스',       category: '가슴', equipment: '머신',   met: 5.5, unit: 'reps', duration_per_set: 0.7, body_part: '대흉근, 삼두근',               search_en: 'lever chest press',               image_url: IMG + '0576-DOoWcnA.gif' },
  { id: 'pullup',              name: '풀업',                     category: '등',   equipment: '맨몸',   met: 8.0, unit: 'reps', duration_per_set: 0.7, body_part: '광배근, 이두근',               search_en: 'pull-up',                         image_url: IMG + '0652-lBDjFxJ.gif' },
  { id: 'chinup',              name: '친업',                     category: '등',   equipment: '맨몸',   met: 8.0, unit: 'reps', duration_per_set: 0.7, body_part: '광배근, 이두근',               search_en: 'chin-up',                         image_url: IMG + '1326-T2mxWqc.gif' },
  { id: 'deadlift',            name: '데드리프트',               category: '등',   equipment: '바벨',   met: 6.5, unit: 'reps', duration_per_set: 0.7, body_part: '후면사슬, 광배근, 햄스트링',   search_en: 'barbell deadlift',                image_url: IMG + '0032-ila4NZS.gif' },
  { id: 't-bar-row',           name: 'T-바 로우',                category: '등',   equipment: '바벨',   met: 6.0, unit: 'reps', duration_per_set: 0.7, body_part: '광배근, 승모근',               search_en: 't-bar row',                       image_url: IMG + '1351-FVM1AUZ.gif' },
  { id: 'barbell-row',         name: '바벨 벤트오버 로우',       category: '등',   equipment: '바벨',   met: 6.0, unit: 'reps', duration_per_set: 0.7, body_part: '광배근, 승모근, 후면 삼각근',  search_en: 'barbell bent over row',           image_url: IMG + '0027-eZyBC3j.gif' },
  { id: 'barbell-squat',       name: '바벨 백 스쿼트',           category: '하체', equipment: '바벨',   met: 6.5, unit: 'reps', duration_per_set: 0.7, body_part: '대퇴사두, 대둔근',             search_en: 'barbell squat',                   image_url: IMG + '0043-qXTaZnJ.gif' },
  { id: 'romanian-deadlift',   name: '루마니안 데드리프트',      category: '하체', equipment: '바벨',   met: 6.0, unit: 'reps', duration_per_set: 0.7, body_part: '햄스트링, 대둔근',             search_en: 'romanian deadlift',               image_url: IMG + '0085-wQ2c4XD.gif' },
  { id: 'hip-thrust',          name: '힙 쓰러스트',              category: '하체', equipment: '맨몸',   met: 5.5, unit: 'reps', duration_per_set: 0.7, body_part: '대둔근, 햄스트링',             search_en: 'hip thrust',                      image_url: IMG + '3236-Pjbc0Kt.gif' },
  { id: 'calf-raise',          name: '스탠딩 카프 레이즈',       category: '하체', equipment: '바벨',   met: 4.0, unit: 'reps', duration_per_set: 0.7, body_part: '비복근',                       search_en: 'standing calf raise',             image_url: IMG + '1371-ipvgBnC.gif' },
  { id: 'shrug-barbell',       name: '바벨 슈러그',              category: '어깨', equipment: '바벨',   met: 4.0, unit: 'reps', duration_per_set: 0.7, body_part: '승모근',                       search_en: 'barbell shrug',                   image_url: IMG + '0095-dG7tG5y.gif' },
  { id: 'upright-row',         name: '업라이트 로우',            category: '어깨', equipment: '바벨',   met: 5.0, unit: 'reps', duration_per_set: 0.7, body_part: '삼각근, 승모근',               search_en: 'barbell upright row',             image_url: IMG + '0120-UDlhcO8.gif' },
  { id: 'face-pull',           name: '페이스 풀',                category: '어깨', equipment: '케이블', met: 4.5, unit: 'reps', duration_per_set: 0.7, body_part: '후면 삼각근, 승모근',          search_en: 'cable face pull',                 image_url: IMG + '3697-G61cXLk.gif' },
  { id: 'ez-bar-curl',         name: 'EZ바 컬',                  category: '팔',   equipment: '바벨',   met: 4.0, unit: 'reps', duration_per_set: 0.7, body_part: '상완이두근',                   search_en: 'ez barbell curl',                 image_url: IMG + '0447-6TG6x2w.gif' },
  { id: 'preacher-curl',       name: '프리처 컬',                category: '팔',   equipment: '바벨',   met: 4.0, unit: 'reps', duration_per_set: 0.7, body_part: '상완이두근',                   search_en: 'barbell preacher curl',           image_url: IMG + '0070-qOgPVf6.gif' },
  { id: 'close-grip-bench',    name: '클로즈그립 벤치프레스',    category: '팔',   equipment: '바벨',   met: 5.5, unit: 'reps', duration_per_set: 0.7, body_part: '삼두근, 대흉근',               search_en: 'barbell close-grip bench press',  image_url: IMG + '0030-J6Dx1Mu.gif' },
  { id: 'tricep-dip',          name: '트라이셉스 딥스',          category: '팔',   equipment: '맨몸',   met: 7.0, unit: 'reps', duration_per_set: 0.7, body_part: '삼두근',                       search_en: 'tricep dips',                     image_url: IMG + '0019-J60bN17.gif' },
  { id: 'plank',               name: '플랭크',                   category: '복근', equipment: '맨몸',   met: 3.5, unit: 'reps', duration_per_set: 0.7, body_part: '복직근, 코어',                 search_en: 'front plank',                     image_url: IMG + '3239-h1ezqSu.gif' },
  { id: 'hanging-knee-raise',  name: '행잉 니 레이즈',           category: '복근', equipment: '맨몸',   met: 5.0, unit: 'reps', duration_per_set: 0.7, body_part: '복직근 하부',                  search_en: 'hanging straight leg raise',      image_url: IMG + '0475-4Ml7QFO.gif' },
  { id: 'russian-twist',       name: '러시안 트위스트',          category: '복근', equipment: '덤벨',   met: 4.0, unit: 'reps', duration_per_set: 0.7, body_part: '복사근',                       search_en: 'russian twist',                   image_url: IMG + '0846-fZFZ704.gif' },
  { id: 'mountain-climber',    name: '마운틴 클라이머',          category: '복근', equipment: '맨몸',   met: 8.0, unit: 'reps', duration_per_set: 0.7, body_part: '코어, 심폐',                   search_en: 'mountain climber',                image_url: IMG + '0630-RJgzwny.gif' },
  { id: 'burpee',              name: '버피',                     category: '맨몸', equipment: '맨몸',   met: 8.0, unit: 'reps', duration_per_set: 0.7, body_part: '전신',                         search_en: 'burpee',                          image_url: IMG + '1160-dK9394r.gif' },
  { id: 'battle-rope',         name: '배틀 로프',                category: '맨몸', equipment: '유산소기구', met: 8.0, unit: 'reps', duration_per_set: 0.7, body_part: '전신, 어깨',               search_en: 'battling ropes',                  image_url: IMG + '0128-RJa4tCo.gif' },
  { id: 'elliptical-machine',  name: '일립티컬',                 category: '유산소', equipment: '유산소기구', met: 5.0, unit: 'time',                          body_part: '전신',                         search_en: 'elliptical machine',              image_url: IMG + '2141-rjtuP6X.gif' },

  // ── 매일 맨몸(고정 노출) ──
  { id: 'bw-lunge',            name: '런지 (맨몸)',              category: '하체', equipment: '맨몸',   met: 5.5, unit: 'reps', duration_per_set: 0.6, body_part: '대퇴사두근, 대둔근',           search_en: 'bodyweight lunge' },
  { id: 'ab-slide',            name: 'AB 슬라이드',              category: '복근', equipment: '맨몸',   met: 5.0, unit: 'reps', duration_per_set: 0.6, body_part: '복직근, 코어',                 search_en: 'ab wheel rollout' },
]
