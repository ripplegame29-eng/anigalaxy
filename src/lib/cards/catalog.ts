/**
 * Каталог карт AniGalaxy: персонажи популярных аниме.
 *
 * Строка: ранг | имя | поисковое имя для AniList | тайтл | стихия | класс
 * Ранг: 0 обычная, 1 редкая, 2 эпическая, 3 легендарная, 4 мифическая.
 * Арт подтягивает `tools/cards-sync.mjs`; пока файла нет, рисуется заглушка.
 */

import type { CardClass, Element, Rank } from "./config";

export interface CardDef {
  id: string;
  rank: Rank;
  name: string;
  /** Имя для поиска на AniList */
  search: string;
  series: string;
  element: Element;
  cls: CardClass;
  atk: number;
  def: number;
  hp: number;
  spd: number;
  /** Короткая цитата/описание */
  blurb: string;
}

const T = (el: string): Element => ({ f: "fire", w: "water", a: "wind", e: "earth", l: "light", d: "dark" } as const)[el as "f"];
const C = (c: string): CardClass => ({ w: "warrior", m: "mage", t: "tank", a: "assassin", s: "support" } as const)[c as "w"];

const RAW = `
0|Сакура Харуно|Sakura Haruno|Наруто|e|s
0|Рок Ли|Rock Lee|Наруто|w|w
0|Шикамару Нара|Shikamaru Nara|Наруто|d|m
0|Усопп|Usopp|Ван-Пис|a|a
0|Тони Тони Чоппер|Tony Tony Chopper|Ван-Пис|e|s
0|Нами|Nami|Ван-Пис|a|m
0|Рукия Кучики|Rukia Kuchiki|Блич|w|m
0|Армин Арлерт|Armin Arlert|Атака титанов|w|s
0|Зеницу Агацума|Zenitsu Agatsuma|Истребитель демонов|a|a
0|Иноске Хашибира|Inosuke Hashibira|Истребитель демонов|e|w
0|Нэдзуко Камадо|Nezuko Kamado|Истребитель демонов|f|t
0|Нобара Кугисаки|Nobara Kugisaki|Магическая битва|e|m
0|Тоге Инумаки|Toge Inumaki|Магическая битва|a|s
0|Мису Амане|Misa Amane|Тетрадь смерти|l|s
0|Рюк|Ryuk|Тетрадь смерти|d|m
0|Альфонс Элрик|Alphonse Elric|Стальной алхимик|e|t
0|Риза Хоукай|Riza Hawkeye|Стальной алхимик|f|a
0|Гон Фрикс|Gon Freecss|Охотник х Охотник|e|w
0|Пикколо|Piccolo|Драгонболл|e|t
0|Очако Урарака|Ochaco Uraraka|Моя геройская академия|l|s
0|Генос|Genos|Ванпанчмен|f|m
0|Асуна Юки|Asuna Yuuki|Мастера Меча Онлайн|w|w
0|Тока Кирисима|Touka Kirishima|Токийский гуль|w|a
0|Аня Форджер|Anya Forger|Семья шпиона|l|s
0|Пауэр|Power|Человек-бензопила|f|w
0|Аки Хаякава|Aki Hayakawa|Человек-бензопила|d|a
0|Фрирен|Frieren|Провожающая в последний путь Фрирен|l|m
0|Ферн|Fern|Провожающая в последний путь Фрирен|a|m
0|Рем|Rem|Re:Zero|w|t
0|Эмилия|Emilia|Re:Zero|w|m
0|Мэгумин|Megumin|Коносуба|f|m
0|Аква|Aqua|Коносуба|w|s
0|Люси Хартфилия|Lucy Heartfilia|Хвост Феи|l|s
0|Грей Фуллбастер|Gray Fullbuster|Хвост Феи|w|m
0|Аста|Asta|Чёрный клевер|d|w
0|Юно|Yuno|Чёрный клевер|a|m
0|Синдзи Икари|Shinji Ikari|Евангелион|d|t
0|Курису Макисэ|Kurisu Makise|Врата Штейна|l|s
0|Сёё Хината|Shoyo Hinata|Волейбол!!|f|a
0|Сэнку Исигами|Senku Ishigami|Доктор Стоун|e|s
1|Саске Утиха|Sasuke Uchiha|Наруто|f|a
1|Хината Хьюга|Hinata Hyuga|Наруто|l|s
1|Гаара|Gaara|Наруто|e|t
1|Джирайя|Jiraiya|Наруто|f|m
1|Ророноа Зоро|Roronoa Zoro|Ван-Пис|a|w
1|Санджи|Sanji|Ван-Пис|f|w
1|Нико Робин|Nico Robin|Ван-Пис|d|m
1|Трафальгар Ло|Trafalgar Law|Ван-Пис|d|m
1|Тосиро Хицугая|Toshiro Hitsugaya|Блич|w|m
1|Йоруичи Шихоин|Yoruichi Shihoin|Блич|d|a
1|Микаса Аккерман|Mikasa Ackerman|Атака титанов|a|a
1|Эрвин Смит|Erwin Smith|Атака титанов|l|s
1|Гию Томиока|Giyu Tomioka|Истребитель демонов|w|w
1|Синобу Кочо|Shinobu Kocho|Истребитель демонов|a|a
1|Тэнгэн Узуй|Tengen Uzui|Истребитель демонов|l|w
1|Мэгуми Фусигуро|Megumi Fushiguro|Магическая битва|d|m
1|Маки Дзенин|Maki Zenin|Магическая битва|e|w
1|Эдвард Элрик|Edward Elric|Стальной алхимик|e|w
1|Курапика|Kurapika|Охотник х Охотник|l|m
1|Вегета|Vegeta|Драгонболл|l|w
1|Сёто Тодороки|Shoto Todoroki|Моя геройская академия|w|m
1|Кацуки Бакуго|Katsuki Bakugo|Моя геройская академия|f|w
1|Кирито|Kirito|Мастера Меча Онлайн|d|w
1|Кэн Канэки|Ken Kaneki|Токийский гуль|d|a
1|Йор Форджер|Yor Forger|Семья шпиона|d|a
1|Лойд Форджер|Loid Forger|Семья шпиона|l|a
1|Денджи|Denji|Человек-бензопила|f|w
1|Рин Тосака|Rin Tohsaka|Судьба|f|m
1|Рэй Аянами|Rei Ayanami|Евангелион|w|s
1|Аска Лэнгли Сорю|Asuka Langley Soryu|Евангелион|f|w
1|Спайк Шпигель|Spike Spiegel|Ковбой Бибоп|d|a
1|Ринтаро Окабэ|Rintaro Okabe|Врата Штейна|l|m
1|Нацу Драгнил|Natsu Dragneel|Хвост Феи|f|w
1|Сигэо Кагеяма|Shigeo Kageyama|Моб Психо 100|l|m
1|Субару Нацуки|Subaru Natsuki|Re:Zero|d|s
1|Дзётаро Кудзё|Jotaro Kujo|Невероятные приключения ДжоДжо|w|w
2|Наруто Удзумаки|Naruto Uzumaki|Наруто|f|w
2|Какаши Хатаке|Kakashi Hatake|Наруто|l|a
2|Итачи Утиха|Itachi Uchiha|Наруто|d|a
2|Минато Намиказе|Minato Namikaze|Наруто|l|a
2|Монки Д. Луффи|Monkey D. Luffy|Ван-Пис|f|w
2|Портгас Д. Эйс|Portgas D. Ace|Ван-Пис|f|w
2|Боа Хэнкок|Boa Hancock|Ван-Пис|d|a
2|Ичиго Куросаки|Ichigo Kurosaki|Блич|l|w
2|Бьякуя Кучики|Byakuya Kuchiki|Блич|w|m
2|Леви Аккерман|Levi|Атака титанов|a|a
2|Танджиро Камадо|Tanjiro Kamado|Истребитель демонов|w|w
2|Кёджуро Ренгоку|Kyojuro Rengoku|Истребитель демонов|f|w
2|Юдзи Итадори|Yuji Itadori|Магическая битва|f|w
2|Лайт Ягами|Light Yagami|Тетрадь смерти|d|m
2|Эл Лоулайт|L|Тетрадь смерти|l|m
2|Киллуа Золдик|Killua Zoldyck|Охотник х Охотник|a|a
2|Хисока Морроу|Hisoka Morow|Охотник х Охотник|d|a
2|Сон Гоку|Son Goku|Драгонболл|l|w
2|Изуку Мидория|Izuku Midoriya|Моя геройская академия|a|w
2|Сайтама|Saitama|Ванпанчмен|l|w
2|Эндевор|Endeavor|Моя геройская академия|f|t
2|Тацумаки|Tatsumaki|Ванпанчмен|a|m
2|Лелуш Ламперуж|Lelouch Lamperouge|Код Гиасс|d|m
2|Эрза Скарлет|Erza Scarlet|Хвост Феи|f|w
2|Эрен Йегер|Eren Yeager|Атака титанов|f|w
2|Дио Брандо|Dio Brando|Невероятные приключения ДжоДжо|d|a
2|Химмель|Himmel the Hero|Провожающая в последний путь Фрирен|l|w
2|Мэкима|Makima|Человек-бензопила|d|m
3|Всемогущий|All Might|Моя геройская академия|l|w
3|Сатору Годжо|Satoru Gojo|Магическая битва|l|m
3|Мадара Утиха|Madara Uchiha|Наруто|f|m
3|Шанкс|Shanks|Ван-Пис|f|w
3|Соскэ Айзен|Sosuke Aizen|Блич|d|m
3|Кенпачи Зараки|Kenpachi Zaraki|Блич|e|w
3|Кайдо|Kaido|Ван-Пис|w|t
3|Музан Кибуцудзи|Muzan Kibutsuji|Истребитель демонов|d|m
3|Ёрихити Цугикуни|Yoriichi Tsugikuni|Истребитель демонов|f|w
3|Сон Джин-У|Sung Jinwoo|Поднятие уровня в одиночку|d|a
3|Фризер|Frieza|Драгонболл|d|m
3|Гильгамеш|Gilgamesh|Судьба|l|w
3|Артурия Пендрагон|Artoria Pendragon|Судьба|l|w
3|Гароу|Garou|Ванпанчмен|e|w
3|Джорно Джованна|Giorno Giovanna|Невероятные приключения ДжоДжо|l|s
3|Хролло Люцифер|Chrollo Lucilfer|Охотник х Охотник|d|a
4|Рёмэн Сукуна|Ryomen Sukuna|Магическая битва|d|m
4|Гол Д. Роджер|Gol D. Roger|Ван-Пис|d|w
4|Ай Хоси|Ai Hoshino|Оши но Ко|l|s
4|Хагоромо Оцуцуки|Hagoromo Otsutsuki|Наруто|l|m
4|Ихваш|Yhwach|Блич|d|m
4|Меруэм|Meruem|Охотник х Охотник|d|w
4|Айнз Оал Гоун|Ainz Ooal Gown|Оверлорд|d|m
4|Эдвард Ньюгейт|Edward Newgate|Ван-Пис|w|t
0|Тэнтэн|Tenten|Наруто|a|a
0|Ино Яманака|Ino Yamanaka|Наруто|w|s
0|Чоджи Акимичи|Choji Akimichi|Наруто|e|t
0|Киба Инузука|Kiba Inuzuka|Наруто|e|a
0|Брук|Brook|Ван-Пис|d|m
0|Фрэнки|Franky|Ван-Пис|f|t
0|Небтра Виви|Nefertari Vivi|Ван-Пис|w|s
0|Орихиме Иноуэ|Orihime Inoue|Блич|l|s
0|Ясутора Садо|Yasutora Sado|Блич|e|t
0|Урю Исида|Uryu Ishida|Блич|l|m
0|Ренджи Абараи|Renji Abarai|Блич|f|w
0|Саша Браус|Sasha Blouse|Атака титанов|a|a
0|Конни Спрингер|Connie Springer|Атака титанов|a|w
0|Жан Кирштейн|Jean Kirstein|Атака титанов|e|w
0|История Рейсс|Historia Reiss|Атака титанов|l|s
0|Канао Цуюри|Kanao Tsuyuri|Истребитель демонов|f|a
0|Генъя Синадзугава|Genya Shinazugawa|Истребитель демонов|d|w
0|Май Дзенин|Mai Zenin|Магическая битва|f|m
0|Мелло|Mello|Тетрадь смерти|f|a
0|Нир|Near|Тетрадь смерти|l|m
0|Уинри Рокбелл|Winry Rockbell|Стальной алхимик|e|s
0|Алекс Армстронг|Alex Louis Armstrong|Стальной алхимик|e|t
0|Леорио Парадинайт|Leorio Paradinight|Охотник х Охотник|l|s
0|Бискит Круэгер|Biscuit Krueger|Охотник х Охотник|l|m
0|Кулилин|Krillin|Драгонболл|l|w
0|Бульма|Bulma|Драгонболл|w|s
0|Мина Асидо|Mina Ashido|Моя геройская академия|d|a
0|Тенья Иида|Tenya Iida|Моя геройская академия|a|a
0|Цую Асуи|Tsuyu Asui|Моя геройская академия|w|a
0|Эйджиро Киришима|Eijiro Kirishima|Моя геройская академия|e|t
0|Фубуки|Fubuki|Ванпанчмен|a|m
0|Мумэн Райдер|Mumen Rider|Ванпанчмен|w|w
0|Лизбет|Lisbeth|Мастера Меча Онлайн|f|w
0|Силика|Silica|Мастера Меча Онлайн|w|a
0|Химэно|Himeno|Человек-бензопила|d|m
0|Кобэни Хигасияма|Kobeni Higashiyama|Человек-бензопила|w|t
0|Хайтер|Heiter|Провожающая в последний путь Фрирен|l|s
0|Рам|Ram|Re:Zero|w|m
0|Лалатина Дастинесс Форд|Lalatina Dustiness Ford|Коносуба|e|t
0|Венди Марвелл|Wendy Marvell|Хвост Феи|a|s
1|Неджи Хьюга|Neji Hyuga|Наруто|l|a
1|Цунаде|Tsunade|Наруто|e|s
1|Орочимару|Orochimaru|Наруто|d|m
1|Обито Утиха|Obito Uchiha|Наруто|d|a
1|Нагато|Nagato|Наруто|d|m
1|Джимбэй|Jinbe|Ван-Пис|w|t
1|Сабо|Sabo|Ван-Пис|f|w
1|Гриммджо Джагерджак|Grimmjow Jaegerjaquez|Блич|w|w
1|Улькиорра Шиффер|Ulquiorra Cifer|Блич|d|a
1|Кискэ Урахара|Kisuke Urahara|Блич|f|m
1|Ханджи Зоэ|Hange Zoe|Атака титанов|f|m
1|Райнер Браун|Reiner Braun|Атака титанов|e|t
1|Энни Леонхарт|Annie Leonhart|Атака титанов|w|a
1|Мицури Канроджи|Mitsuri Kanroji|Истребитель демонов|f|w
1|Обанай Игуро|Obanai Iguro|Истребитель демонов|a|a
1|Санеми Синадзугава|Sanemi Shinazugawa|Истребитель демонов|a|w
1|Гёмэй Химэдзима|Gyomei Himejima|Истребитель демонов|e|t
1|Аказа|Akaza|Истребитель демонов|d|w
1|Юта Оккоцу|Yuta Okkotsu|Магическая битва|l|m
1|Кэнто Нанами|Kento Nanami|Магическая битва|e|w
1|Аой Тодо|Aoi Todo|Магическая битва|e|w
1|Рой Мустанг|Roy Mustang|Стальной алхимик|f|m
1|Скар|Scar|Стальной алхимик|e|w
1|Айзек Нетеро|Isaac Netero|Охотник х Охотник|l|w
1|Сон Гохан|Son Gohan|Драгонболл|l|w
1|Транкс|Trunks|Драгонболл|l|w
1|Андроид 18|Android 18|Драгонболл|l|a
1|Момо Яойорозу|Momo Yaoyorozu|Моя геройская академия|l|s
1|Даби|Dabi|Моя геройская академия|f|a
1|Химико Тога|Himiko Toga|Моя геройская академия|d|a
1|Серебряный Клык|Silver Fang|Ванпанчмен|w|w
1|Металлическая Бита|Metal Bat|Ванпанчмен|f|w
1|Рэйгэн Аратака|Reigen Arataka|Моб Психо 100|l|s
1|Фэй Валентайн|Faye Valentine|Ковбой Бибоп|d|a
1|Мисато Кацураги|Misato Katsuragi|Евангелион|f|a
1|Гинтоки Саката|Gintoki Sakata|Гинтама|e|w
2|Хаширама Сенджу|Hashirama Senju|Наруто|e|w
2|Майто Гай|Might Guy|Наруто|w|w
2|Дракуль Михок|Dracule Mihawk|Ван-Пис|d|w
2|Борсалино|Borsalino|Ван-Пис|l|a
2|Сакадзуки|Sakazuki|Ван-Пис|f|w
2|Кузан|Kuzan|Ван-Пис|w|m
2|Марко|Marco|Ван-Пис|f|a
2|Генрюсай Ямамото|Genryusai Shigekuni Yamamoto|Блич|f|m
2|Зик Йегер|Zeke Yeager|Атака титанов|e|m
2|Кокушибо|Kokushibo|Истребитель демонов|d|w
2|Мукиро Токито|Muichiro Tokito|Истребитель демонов|a|a
2|Тодзи Фусигуро|Toji Fushiguro|Магическая битва|d|a
2|Сугуру Гэто|Suguru Geto|Магическая битва|d|m
2|Махито|Mahito|Магическая битва|d|m
2|Кинг Брэдли|King Bradley|Стальной алхимик|d|a
2|Ван Хоэнхайм|Van Hohenheim|Стальной алхимик|l|m
2|Иллуми Золдик|Illumi Zoldyck|Охотник х Охотник|d|a
2|Броли|Broly|Драгонболл|l|w
2|Вегито|Vegito|Драгонболл|l|w
2|Кай Тисаки|Kai Chisaki|Моя геройская академия|d|m
2|Томура Шигараки|Tomura Shigaraki|Моя геройская академия|d|m
2|Хоукс|Hawks|Моя геройская академия|a|a
2|Флэши Флэш|Flashy Flash|Ванпанчмен|a|a
2|Синон|Sinon|Мастера Меча Онлайн|w|m
2|Кисё Арима|Kishou Arima|Токийский гуль|l|w
2|Тосиро Хиджиката|Toshiro Hijikata|Гинтама|d|w
2|Серие|Serie|Провожающая в последний путь Фрирен|l|m
2|Мелиодас|Meliodas|Семь смертных грехов|f|w
3|Тобирама Сенджу|Tobirama Senju|Наруто|w|a
3|Курама|Kurama|Наруто|f|m
3|Маршалл Д. Тич|Marshall D. Teach|Ван-Пис|d|t
3|Монки Д. Гарп|Monkey D. Garp|Ван-Пис|e|w
3|Шарлотта Линлин|Charlotte Linlin|Ван-Пис|d|t
3|Гин Ичимару|Gin Ichimaru|Блич|d|a
3|Югрэм Хашвальт|Jugram Haschwalth|Блич|l|m
3|Имир Фриц|Ymir Fritz|Атака титанов|e|m
3|Дома|Doma|Истребитель демонов|l|m
3|Юки Цукумо|Yuki Tsukumo|Магическая битва|l|m
3|Кэндзяку|Kenjaku|Магическая битва|d|m
3|Бирус|Beerus|Драгонболл|d|m
3|Джирен|Jiren|Драгонболл|f|w
3|Непферпито|Neferpitou|Охотник х Охотник|d|a
3|Всё за Одного|All For One|Моя геройская академия|d|m
3|Борос|Boros|Ванпанчмен|d|m
3|Эскаллор|Escanor|Семь смертных грехов|l|w
4|Кагуя Оцуцуки|Kaguya Otsutsuki|Наруто|l|m
4|Зено|Zeno|Драгонболл|l|m
4|Аностос Волдигод|Anos Voldigoad|Могущественнейший демон|d|m
4|Римуру Темпест|Rimuru Tempest|О моём перерождении в слизь|w|m
4|Алукард|Alucard|Хеллсинг|d|a
4|Карс|Kars|Невероятные приключения ДжоДжо|d|m
4|Гатс|Guts|Берсерк|d|w
4|Гриффит|Griffith|Берсерк|l|m
0|Такемити Ханагаки|Takemichi Hanagaki|Токийские мстители|f|w
3|Манджиро Сано|Manjirou Sano|Токийские мстители|l|w
1|Кэн Рюгудзи|Ken Ryuuguuji|Токийские мстители|f|t
0|Хината Тачибана|Hinata Tachibana|Токийские мстители|w|s
1|Кэйскэ Баджи|Keisuke Baji|Токийские мстители|d|a
0|Тифую Мацуно|Chifuyu Matsuno|Токийские мстители|a|w
0|Ацуси Сэндо|Atsushi Sendou|Токийские мстители|e|t
1|Кадзутора Ханемия|Kazutora Hanemiya|Токийские мстители|a|a
2|Идзана Курокава|Izana Kurokawa|Токийские мстители|d|a
0|Наото Тачибана|Naoto Tachibana|Токийские мстители|w|s
1|Ёити Исаги|Yoichi Isagi|Синяя тюрьма|l|w
1|Мэгуру Бачира|Meguru Bachira|Синяя тюрьма|a|a
1|Сэйсиро Наги|Seishirou Nagi|Синяя тюрьма|l|m
2|Рин Итоси|Rin Itoshi|Синяя тюрьма|d|a
1|Сёэй Бароу|Shouei Barou|Синяя тюрьма|e|w
0|Рэо Микагэ|Reo Mikage|Синяя тюрьма|w|s
2|Дзинпачи Эго|Jinpachi Ego|Синяя тюрьма|d|s
0|Анри Тэиэри|Anri Teieri|Синяя тюрьма|l|s
2|Саэ Итоси|Sae Itoshi|Синяя тюрьма|d|m
0|Рэнсукэ Кунигами|Rensuke Kunigami|Синяя тюрьма|e|t
0|Хёма Тигири|Hyouma Chigiri|Синяя тюрьма|f|a
2|Майкл Кайзер|Michael Kaiser|Синяя тюрьма|a|m
1|Синра Кусакабэ|Shinra Kusakabe|Пламенная бригада|f|w
0|Артур Бойл|Arthur Boyle|Пламенная бригада|l|w
0|Маки Озе|Maki Oze|Пламенная бригада|f|a
0|Тамаки Котацу|Tamaki Kotatsu|Пламенная бригада|f|t
1|Сё Кусакабэ|Sho Kusakabe|Пламенная бригада|a|a
0|Хибана|Hibana|Пламенная бригада|f|m
1|Такэхиса Хинава|Takehisa Hinawa|Пламенная бригада|a|w
1|Вулкан Джозеф|Vulcan Joseph|Пламенная бригада|e|s
1|Бенимару Синмон|Benimaru Shinmon|Пламенная бригада|f|t
1|Рэкка Хосимия|Rekka Hoshimiya|Пламенная бригада|f|w
1|Тобио Кагэяма|Tobio Kageyama|Волейбол!!|a|m
0|Кэй Цукисима|Kei Tsukishima|Волейбол!!|l|t
1|Косси Сугавара|Koushi Sugawara|Волейбол!!|w|s
0|Дайти Савамура|Daichi Sawamura|Волейбол!!|e|t
0|Ю Нисиноя|Yuu Nishinoya|Волейбол!!|a|t
1|Тэцуро Куроо|Tetsurou Kuroo|Волейбол!!|d|t
0|Кэнма Козумэ|Kenma Kozume|Волейбол!!|d|m
2|Тоору Ойкава|Tooru Oikawa|Волейбол!!|w|m
2|Котаро Бокуто|Koutarou Bokuto|Волейбол!!|l|w
0|Хитока Ячи|Hitoka Yachi|Волейбол!!|l|s
1|Киёко Симидзу|Kiyoko Shimizu|Волейбол!!|w|s
2|Кушина Удзумаки|Kushina Uzumaki|Наруто|f|s
0|Сидзунэ|Shizune|Наруто|w|s
1|Чиё|Chiyo|Наруто|d|s
1|Хаку|Haku|Наруто|w|s
2|Кисамэ Хосигаки|Kisame Hoshigaki|Наруто|w|t
2|Какудзу|Kakuzu|Наруто|d|t
1|Джуго|Jugo|Наруто|e|t
0|Карин|Karin|Наруто|f|s
3|Ямато|Yamato|Наруто|e|s
2|Мэй Тэруми|Mei Terumi|Наруто|f|m
2|Макаров Дреяр|Makarov Dreyar|Хвост Феи|l|t
2|Мавис Вермилион|Mavis Vermilion|Хвост Феи|l|s
2|Гилдартс Клайв|Gildarts Clive|Хвост Феи|e|t
1|Лаксус Дреяр|Laxus Dreyar|Хвост Феи|a|w
1|Мираджейн Штраусс|Mirajane Strauss|Хвост Феи|w|m
0|Джувия Локсар|Juvia Lockser|Хвост Феи|w|m
1|Гажил Редфокс|Gajeel Redfox|Хвост Феи|a|t
0|Эльфман Штраусс|Elfman Strauss|Хвост Феи|e|t
0|Лиссана Штраусс|Lisanna Strauss|Хвост Феи|w|s
2|Джеллал Фернандес|Jellal Fernandes|Хвост Феи|l|m
1|Дайан|Diane|Семь смертных грехов|e|t
1|Бан|Ban|Семь смертных грехов|d|w
1|Говер|Gowther|Семь смертных грехов|a|m
2|Мерлин|Merlin|Семь смертных грехов|a|m
2|Элизабет Лионес|Elizabeth Liones|Семь смертных грехов|a|s
0|Хок|Hawk|Семь смертных грехов|e|t
2|Зелдрис|Zeldris|Семь смертных грехов|d|a
0|Гилтандер|Gilthunder|Семь смертных грехов|a|w
2|Дзёсукэ Хигасиката|Josuke Higashikata|Невероятные приключения ДжоДжо|a|s
1|Мухаммед Абдул|Muhammad Avdol|Невероятные приключения ДжоДжо|f|t
1|Норияки Какёин|Noriaki Kakyoin|Невероятные приключения ДжоДжо|e|m
1|Жан-Пьер Польнарефф|Jean Pierre Polnareff|Невероятные приключения ДжоДжо|a|w
2|Джозеф Джостар|Joseph Joestar|Невероятные приключения ДжоДжо|a|a
0|Джонатан Джостар|Jonathan Joestar|Невероятные приключения ДжоДжо|l|w
0|Гвидо Миста|Guido Mista|Невероятные приключения ДжоДжо|f|a
0|Наранча Гирга|Narancia Ghirga|Невероятные приключения ДжоДжо|f|a
0|Чарми Паппиттсон|Charmy Pappitson|Чёрный клевер|e|s
0|Мимоза Вермилион|Mimosa Vermillion|Чёрный клевер|l|s
2|Ями Сукэхиро|Yami Sukehiro|Чёрный клевер|d|w
2|Юлиус Новахрон|Julius Novachrono|Чёрный клевер|l|m
0|Ноэлль Сильва|Noelle Silva|Чёрный клевер|w|m
1|Фуэгон Вермилион|Fuegoleon Vermillion|Чёрный клевер|f|w
1|Нозель Сильва|Nozel Silva|Чёрный клевер|w|t
0|Магна Суинг|Magna Swing|Чёрный клевер|f|w
1|Лак Вольтия|Luck Voltia|Чёрный клевер|a|a
1|Секре Свэллоутейл|Secre Swallowtail|Чёрный клевер|d|s
1|Мереолеона Вермилион|Mereoleona Vermillion|Чёрный клевер|f|w
0|Ванесса Энотека|Vanessa Enoteca|Чёрный клевер|w|m
0|Зора Идеале|Zora Ideale|Чёрный клевер|e|a
0|Видель|Videl|Драгонболл|w|w
0|Ямча|Yamcha|Драгонболл|a|w
0|Руи|Rui|Истребитель демонов|w|m
0|Кёгай|Kyougai|Истребитель демонов|d|m
0|Дэнки Каминари|Denki Kaminari|Моя геройская академия|l|m
0|Тенсинхан|Tenshinhan|Драгонболл|a|a
0|Фумикагэ Токоями|Fumikage Tokoyami|Моя геройская академия|d|a
0|Маес Хьюз|Maes Hughes|Стальной алхимик|a|a
1|Рангику Мацумото|Rangiku Matsumoto|Блич|f|m
1|Маюри Куроцути|Mayuri Kurotsuchi|Блич|a|m
1|Стейн|Stain|Моя геройская академия|a|a
1|Дзюдзо Судзуя|Juuzou Suzuya|Токийский гуль|a|a
1|Лан Фан|Lan Fan|Стальной алхимик|w|a
1|Сёко Иэири|Shoko Ieiri|Магическая битва|l|s
2|Грид|Greed|Стальной алхимик|e|t
2|Кинджи Хакари|Kinji Hakari|Магическая битва|a|t
2|Маджин Буу|Majin Buu|Драгонболл|f|t
2|Рецу Унохана|Retsu Unohana|Блич|a|s
2|Аллука Золдик|Alluka Zoldyck|Охотник х Охотник|d|s
2|Дзюсиро Укитакэ|Juushirou Ukitake|Блич|l|s
3|Отец|Father|Стальной алхимик|d|m
3|Баррагану Луизенбарн|Barragan Luisenbarn|Блич|d|t
3|Акихико Каяба|Akihiko Kayaba|Мастера Меча Онлайн|l|t
3|Сильва Золдик|Silva Zoldyck|Охотник х Охотник|e|t
3|Хит|Hit|Драгонболл|a|a
3|Цюаньси|Quanxi|Человек-бензопила|a|a
3|Кенни Аккерман|Kenny Ackerman|Атака титанов|e|a
3|Сасори|Sasori|Наруто|e|a
3|Жанна д'Арк|Jeanne d'Arc|Судьба|l|s
3|Медея|Medea|Судьба|d|s
3|Илиясфиль фон Айнцберн|Illyasviel von Einzbern|Судьба|l|s
4|Бласт|Blast|Ванпанчмен|e|w
4|Зереф Драгнил|Zeref Dragneel|Хвост Феи|w|m
4|Почита|Pochita|Человек-бензопила|f|t
4|Уис|Whis|Драгонболл|a|s
4|Вальтер К. Дорнез|Walter C. Dornez|Хеллсинг|d|a
`;

const BASE: Record<number, [number, number, number, number]> = {
  0: [50, 40, 300, 40],
  1: [75, 60, 420, 50],
  2: [110, 85, 600, 60],
  3: [160, 120, 880, 72],
  4: [230, 170, 1250, 85],
};

/** Склонность стихии/класса к статам (множители в процентах) */
const CLS_MUL: Record<CardClass, [number, number, number, number]> = {
  warrior: [112, 100, 105, 100],
  mage: [118, 85, 90, 105],
  tank: [85, 130, 125, 85],
  assassin: [120, 85, 85, 125],
  support: [86, 94, 98, 102],
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function build(): CardDef[] {
  const out: CardDef[] = [];
  const seen = new Set<string>();
  for (const line of RAW.trim().split("\n")) {
    const [r, name, search, series, el, c] = line.split("|");
    const rank = Number(r) as Rank;
    let id = slug(search);
    while (seen.has(id)) id += "-x";
    seen.add(id);
    const cls = C(c);
    const mul = CLS_MUL[cls];
    const b = BASE[rank];
    const h = hash(id);
    const jit = (n: number) => 96 + ((h >>> n) % 9); // 96..104
    out.push({
      id,
      rank,
      name,
      search,
      series,
      element: T(el),
      cls,
      atk: Math.round((b[0] * mul[0] * jit(1)) / 10000),
      def: Math.round((b[1] * mul[1] * jit(5)) / 10000),
      hp: Math.round((b[2] * mul[2] * jit(9)) / 10000),
      spd: Math.round((b[3] * mul[3] * jit(13)) / 10000),
      blurb: "",
    });
  }
  return out;
}

export const CATALOG: CardDef[] = build();
const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export const cardDef = (id: string): CardDef | undefined => BY_ID.get(id);
/** Герои без фото на AniList: не выпадают из паков (уже выпавшие остаются у владельцев) */
let hidden = new Set<string>();
export const setHidden = (ids: string[]): void => {
  hidden = new Set(ids);
};
export const isHidden = (id: string): boolean => hidden.has(id);

/** Пул для выпадения: только герои с артом (если арт подтверждённо отсутствует — героя заменяют другие) */
export const cardsOfRank = (rank: Rank): CardDef[] => {
  const all = CATALOG.filter((c) => c.rank === rank);
  const ok = all.filter((c) => !hidden.has(c.id));
  return ok.length ? ok : all;
};

/** Каталог для альбома: скрытые показываются только тем, у кого они уже есть */
export const visibleCatalog = (owned: ReadonlySet<string>): CardDef[] => CATALOG.filter((c) => !hidden.has(c.id) || owned.has(c.id));
