/**
 * Каталог карт AniGalaxy: персонажи популярных аниме.
 *
 * Строка: ранг | имя | поисковое имя для AniList | тайтл | стихия | класс | номер
 * Ранг: 0 обычная, 1 редкая, 2 эпическая, 3 легендарная, 4 мифическая.
 * Номер (1..500) — место по популярности: 1–15 SS, 16–55 S, 56–140 A, 141–290 B, остальные C.
 * Арт подтягивает `tools/cards-sync.mjs`; пока файла нет, рисуется заглушка.
 */

import type { CardClass, Element, Rank } from "./config";

export interface CardDef {
  id: string;
  rank: Rank;
  /** Номер в коллекции (место по популярности) */
  num: number;
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
4|Фрирен|Frieren|Провожающая в последний путь Фрирен|l|m|1
4|Сатору Годжо|Satoru Gojo|Магическая битва|l|m|2
4|Макима|Makima|Человек-бензопила|d|m|3
4|Сон Джин-У|Sung Jinwoo|Поднятие уровня в одиночку|d|a|4
4|Ичиго Куросаки|Ichigo Kurosaki|Блич|l|w|5
4|Монки Д. Луффи|Monkey D. Luffy|Ван-Пис|f|w|6
4|Итачи Утиха|Itachi Uchiha|Наруто|d|a|7
4|Леви Аккерман|Levi|Атака титанов|a|a|8
4|Рёмэн Сукуна|Ryomen Sukuna|Магическая битва|d|m|9
4|Зеро Ту|Zero Two|Любимый во Франксе|f|m|10
4|Эрен Йегер|Eren Yeager|Атака титанов|f|w|11
4|Рем|Rem|Re:Zero|w|t|12
4|Танджиро Камадо|Tanjiro Kamado|Истребитель демонов|w|w|13
4|Ай Хоси|Ai Hoshino|Оши но Ко|l|s|14
4|Наруто Удзумаки|Naruto Uzumaki|Наруто|f|w|15
3|Саске Утиха|Sasuke Uchiha|Наруто|f|a|16
3|Какаши Хатаке|Kakashi Hatake|Наруто|l|a|17
3|Мадара Утиха|Madara Uchiha|Наруто|f|m|18
3|Ророноа Зоро|Roronoa Zoro|Ван-Пис|a|w|19
3|Санджи|Sanji|Ван-Пис|f|w|20
3|Шанкс|Shanks|Ван-Пис|f|w|21
3|Трафальгар Ло|Trafalgar Law|Ван-Пис|d|m|22
3|Портгас Д. Эйс|Portgas D. Ace|Ван-Пис|f|w|23
3|Сон Гоку|Son Goku|Драгонболл|l|w|24
3|Вегета|Vegeta|Драгонболл|l|w|25
3|Эдвард Элрик|Edward Elric|Стальной алхимик|e|w|26
3|Рой Мустанг|Roy Mustang|Стальной алхимик|f|m|27
3|Лайт Ягами|Light Yagami|Тетрадь смерти|d|m|28
3|Эл Лоулайт|L|Тетрадь смерти|l|m|29
3|Лелуш Ламперуж|Lelouch Lamperouge|Код Гиасс|d|m|30
3|Си Си|C C|Код Гиас|l|s|31
3|Спайк Шпигель|Spike Spiegel|Ковбой Бибоп|d|a|32
3|Гатс|Guts|Берсерк|d|w|33
3|Гриффит|Griffith|Берсерк|l|m|34
3|Киллуа Золдик|Killua Zoldyck|Охотник х Охотник|a|a|35
3|Гон Фрикс|Gon Freecss|Охотник х Охотник|e|w|36
3|Хисока Морроу|Hisoka Morow|Охотник х Охотник|d|a|37
3|Курапика|Kurapika|Охотник х Охотник|l|m|38
3|Денджи|Denji|Человек-бензопила|f|w|39
3|Пауэр|Power|Человек-бензопила|f|w|40
3|Аки Хаякава|Aki Hayakawa|Человек-бензопила|d|a|41
3|Ферн|Fern|Провожающая в последний путь Фрирен|a|m|42
3|Штарк|Stark|Провожающая в последний путь Фрирен|f|w|43
3|Химмель|Himmel the Hero|Провожающая в последний путь Фрирен|l|w|44
3|Мэгуми Фусигуро|Megumi Fushiguro|Магическая битва|d|m|45
3|Нобара Кугисаки|Nobara Kugisaki|Магическая битва|e|m|46
3|Юта Оккоцу|Yuta Okkotsu|Магическая битва|l|m|47
3|Тодзи Фусигуро|Toji Fushiguro|Магическая битва|d|a|48
3|Кэнто Нанами|Kento Nanami|Магическая битва|e|w|49
3|Нэдзуко Камадо|Nezuko Kamado|Истребитель демонов|f|t|50
3|Зеницу Агацума|Zenitsu Agatsuma|Истребитель демонов|a|a|51
3|Иноске Хашибира|Inosuke Hashibira|Истребитель демонов|e|w|52
3|Кёджуро Ренгоку|Kyojuro Rengoku|Истребитель демонов|f|w|53
3|Тэнгэн Узуй|Tengen Uzui|Истребитель демонов|l|w|54
3|Синобу Кочо|Shinobu Kocho|Истребитель демонов|a|a|55
2|Гию Томиока|Giyu Tomioka|Истребитель демонов|w|w|56
2|Музан Кибуцудзи|Muzan Kibutsuji|Истребитель демонов|d|m|57
2|Микаса Аккерман|Mikasa Ackerman|Атака титанов|a|a|58
2|Армин Арлерт|Armin Arlert|Атака титанов|w|s|59
2|Эрвин Смит|Erwin Smith|Атака титанов|l|s|60
2|Изуку Мидория|Izuku Midoriya|Моя геройская академия|a|w|61
2|Кацуки Бакуго|Katsuki Bakugo|Моя геройская академия|f|w|62
2|Сёто Тодороки|Shoto Todoroki|Моя геройская академия|w|m|63
2|Всемогущий|All Might|Моя геройская академия|l|w|64
2|Сайтама|Saitama|Ванпанчмен|l|w|65
2|Генос|Genos|Ванпанчмен|f|m|66
2|Тацумаки|Tatsumaki|Ванпанчмен|a|m|67
2|Сигэо Кагеяма|Shigeo Kageyama|Моб Психо 100|l|m|68
2|Кэн Канэки|Ken Kaneki|Токийский гуль|d|a|69
2|Тока Кирисима|Touka Kirishima|Токийский гуль|w|a|70
2|Кирито|Kirito|Мастера Меча Онлайн|d|w|71
2|Асуна Юки|Asuna Yuuki|Мастера Меча Онлайн|w|w|72
2|Эмилия|Emilia|Re:Zero|w|m|73
2|Рам|Ram|Re:Zero|w|m|74
2|Мэгумин|Megumin|Коносуба|f|m|75
2|Аква|Aqua|Коносуба|w|s|76
2|Римуру Темпест|Rimuru Tempest|О моём перерождении в слизь|w|m|77
2|Милим Нава|Milim Nava|О моём перерождении в слизь|f|m|78
2|Айнз Оал Гоун|Ainz Ooal Gown|Оверлорд|d|m|79
2|Альбедо|Albedo|Оверлорд|d|t|80
2|Аня Форджер|Anya Forger|Семья шпиона|l|s|81
2|Лойд Форджер|Loid Forger|Семья шпиона|l|a|82
2|Йор Форджер|Yor Forger|Семья шпиона|d|a|83
2|Торфинн|Thorfinn|Сага о Винланде|w|w|84
2|Аскелад|Askeladd|Сага о Винланде|a|a|85
2|Вайолет Эвергарден|Violet Evergarden|Violet Evergarden|l|s|86
2|Артурия Пендрагон|Artoria Pendragon|Судьба|l|w|87
2|Рин Тосака|Rin Tohsaka|Судьба|f|m|88
2|Гильгамеш|Gilgamesh|Судьба|l|w|89
2|Эсдес|Esdeath|Убийца Акамэ|w|m|90
2|Акаме|Akame|Убийца Акамэ|d|a|91
2|Алукард|Alucard|Хеллсинг|d|a|92
2|Кенпачи Зараки|Kenpachi Zaraki|Блич|e|w|93
2|Соскэ Айзен|Sosuke Aizen|Блич|d|m|94
2|Рукия Кучики|Rukia Kuchiki|Блич|w|m|95
2|Тосиро Хицугая|Toshiro Hitsugaya|Блич|w|m|96
2|Улькиорра Шиффер|Ulquiorra Cifer|Блич|d|a|97
2|Гриммджо Джагерджак|Grimmjow Jaegerjaquez|Блич|w|w|98
2|Ча Хэ-Ин|Cha Hae-In|Поднятие уровня в одиночку|w|w|99
2|Игрис|Igris|Поднятие уровня в одиночку|d|w|100
2|Дэвид Мартинес|David Martinez|Киберпанк: Бегущие по краю|l|a|101
2|Люси|Lucy|Киберпанк: Бегущие по краю|l|a|102
2|Ребекка|Rebecca|Киберпанк: Бегущие по краю|f|a|103
2|Маомао|Maomao|Монолог фармацевта|e|s|104
2|Дзиньши|Jinshi|Монолог фармацевта|l|s|105
2|Кафка Хибино|Kafka Hibino|Кайдзю №8|a|w|106
2|Окарун|Okarun|Дандадан|d|w|107
2|Момо Аясэ|Momo Ayase|Дандадан|l|m|108
2|Сэйсиро Наги|Seishirou Nagi|Синяя тюрьма|l|m|109
2|Ёити Исаги|Yoichi Isagi|Синяя тюрьма|l|w|110
2|Рин Итоси|Rin Itoshi|Синяя тюрьма|d|a|111
2|Мэгуру Бачира|Meguru Bachira|Синяя тюрьма|a|a|112
2|Синра Кусакабэ|Shinra Kusakabe|Пламенная бригада|f|w|113
2|Бенимару Синмон|Benimaru Shinmon|Пламенная бригада|f|t|114
2|Аста|Asta|Чёрный клевер|d|w|115
2|Юно|Yuno|Чёрный клевер|a|m|116
2|Ями Сукэхиро|Yami Sukehiro|Чёрный клевер|d|w|117
2|Мелиодас|Meliodas|Семь смертных грехов|f|w|118
2|Эскаллор|Escanor|Семь смертных грехов|l|w|119
2|Бан|Ban|Семь смертных грехов|d|w|120
2|Хаул|Howl|Ходячий замок|f|m|121
2|Идзуми Миямура|Izumi Miyamura|Хоримия|l|s|122
2|Тидзуру Мидзухара|Chizuru Mizuhara|Арендованная девушка|w|s|123
2|Марин Китагава|Marin Kitagawa|Эта фарфоровая кукла влюбилась|f|s|124
2|Нана Осаки|Nana Osaki|Нана|d|m|125
2|Юно Гасай|Yuno Gasai|Дневник будущего|d|a|126
2|Курами Токисаки|Kurumi Tokisaki|Date A Live|d|m|127
2|Аска Лэнгли Сорю|Asuka Langley Soryu|Евангелион|f|w|128
2|Рэй Аянами|Rei Ayanami|Евангелион|w|s|129
2|Синдзи Икари|Shinji Ikari|Евангелион|d|t|130
2|Дзётаро Кудзё|Jotaro Kujo|Невероятные приключения ДжоДжо|w|w|131
2|Дио Брандо|Dio Brando|Невероятные приключения ДжоДжо|d|a|132
2|Джорно Джованна|Giorno Giovanna|Невероятные приключения ДжоДжо|l|s|133
2|Джонатан Джостар|Jonathan Joestar|Невероятные приключения ДжоДжо|l|w|134
2|Джозеф Джостар|Joseph Joestar|Невероятные приключения ДжоДжо|a|a|135
2|Джолин Куджо|Jolyne Cujoh|ДжоДжо|w|w|136
2|Норияки Какёин|Noriaki Kakyoin|Невероятные приключения ДжоДжо|e|m|137
2|Жан-Пьер Польнарефф|Jean Pierre Polnareff|Невероятные приключения ДжоДжо|a|w|138
2|Дзёсукэ Хигасиката|Josuke Higashikata|Невероятные приключения ДжоДжо|a|s|139
2|Бруно Буччеллати|Bruno Bucciarati|ДжоДжо|l|s|140
1|Диаволо|Diavolo|ДжоДжо|d|a|141
1|Сакура Харуно|Sakura Haruno|Наруто|e|s|142
1|Хината Хьюга|Hinata Hyuga|Наруто|l|s|143
1|Гаара|Gaara|Наруто|e|t|144
1|Джирайя|Jiraiya|Наруто|f|m|145
1|Минато Намиказе|Minato Namikaze|Наруто|l|a|146
1|Обито Утиха|Obito Uchiha|Наруто|d|a|147
1|Пейн|Pain|Наруто|e|m|148
1|Рок Ли|Rock Lee|Наруто|w|w|149
1|Майто Гай|Might Guy|Наруто|w|w|150
1|Орочимару|Orochimaru|Наруто|d|m|151
1|Цунаде|Tsunade|Наруто|e|s|152
1|Шикамару Нара|Shikamaru Nara|Наруто|d|m|153
1|Неджи Хьюга|Neji Hyuga|Наруто|l|a|154
1|Кисамэ Хосигаки|Kisame Hoshigaki|Наруто|w|t|155
1|Дейдара|Deidara|Наруто|f|a|156
1|Хаширама Сенджу|Hashirama Senju|Наруто|e|w|157
1|Кагуя Оцуцуки|Kaguya Otsutsuki|Наруто|l|m|158
1|Нами|Nami|Ван-Пис|a|m|159
1|Усопп|Usopp|Ван-Пис|a|a|160
1|Тони Тони Чоппер|Tony Tony Chopper|Ван-Пис|e|s|161
1|Нико Робин|Nico Robin|Ван-Пис|d|m|162
1|Фрэнки|Franky|Ван-Пис|f|t|163
1|Брук|Brook|Ван-Пис|d|m|164
1|Боа Хэнкок|Boa Hancock|Ван-Пис|d|a|165
1|Эдвард Ньюгейт|Edward Newgate|Ван-Пис|w|t|166
1|Гол Д. Роджер|Gol D. Roger|Ван-Пис|d|w|167
1|Сабо|Sabo|Ван-Пис|f|w|168
1|Кайдо|Kaido|Ван-Пис|w|t|169
1|Шарлотта Линлин|Charlotte Linlin|Ван-Пис|d|t|170
1|Дракуль Михок|Dracule Mihawk|Ван-Пис|d|w|171
1|Борсалино|Borsalino|Ван-Пис|l|a|172
1|Сакадзуки|Sakazuki|Ван-Пис|f|w|173
1|Кузан|Kuzan|Ван-Пис|w|m|174
1|Монки Д. Гарп|Monkey D. Garp|Ван-Пис|e|w|175
1|Донкихот Дофламинго|Donquixote Doflamingo|Ван-Пис|a|a|176
1|Крокодайл|Crocodile|Ван-Пис|e|m|177
1|Ямато|Yamato|Наруто|e|s|178
1|Сон Гохан|Son Gohan|Драгонболл|l|w|179
1|Пикколо|Piccolo|Драгонболл|e|t|180
1|Фризер|Frieza|Драгонболл|d|m|181
1|Селл|Cell|Драгонболл|e|w|182
1|Маджин Буу|Majin Buu|Драгонболл|f|t|183
1|Транкс|Trunks|Драгонболл|l|w|184
1|Броли|Broly|Драгонболл|l|w|185
1|Кулилин|Krillin|Драгонболл|l|w|186
1|Гоку Блэк|Goku Black|Драгонболл|d|m|187
1|Джирен|Jiren|Драгонболл|f|w|188
1|Бульма|Bulma|Драгонболл|w|s|189
1|Бирус|Beerus|Драгонболл|d|m|190
1|Уис|Whis|Драгонболл|a|s|191
1|Андроид 18|Android 18|Драгонболл|l|a|192
1|Орихиме Иноуэ|Orihime Inoue|Блич|l|s|193
1|Ясутора Садо|Yasutora Sado|Блич|e|t|194
1|Урю Исида|Uryu Ishida|Блич|l|m|195
1|Кискэ Урахара|Kisuke Urahara|Блич|f|m|196
1|Йоруичи Шихоин|Yoruichi Shihoin|Блич|d|a|197
1|Бьякуя Кучики|Byakuya Kuchiki|Блич|w|m|198
1|Ренджи Абараи|Renji Abarai|Блич|f|w|199
1|Гин Ичимару|Gin Ichimaru|Блич|d|a|200
1|Синдзи Хирако|Shinji Hirako|Блич|l|a|201
1|Маюри Куроцути|Mayuri Kurotsuchi|Блич|a|m|202
1|Генрюсай Ямамото|Genryusai Shigekuni Yamamoto|Блич|f|m|203
1|Койот Старк|Coyote Starrk|Блич|a|m|204
1|Маки Дзенин|Maki Zenin|Магическая битва|e|w|205
1|Тоге Инумаки|Toge Inumaki|Магическая битва|a|s|206
1|Аой Тодо|Aoi Todo|Магическая битва|e|w|207
1|Сугуру Гэто|Suguru Geto|Магическая битва|d|m|208
1|Махито|Mahito|Магическая битва|d|m|209
1|Дзёго|Jogo|Магическая битва|f|m|210
1|Тёсо|Choso|Магическая битва|w|m|211
1|Кинджи Хакари|Kinji Hakari|Магическая битва|a|t|212
1|Юки Цукумо|Yuki Tsukumo|Магическая битва|l|m|213
1|Мэй Мэй|Mei Mei|Магическая битва|a|a|214
1|Кэндзяку|Kenjaku|Магическая битва|d|m|215
1|Мицури Канроджи|Mitsuri Kanroji|Истребитель демонов|f|w|216
1|Обанай Игуро|Obanai Iguro|Истребитель демонов|a|a|217
1|Санеми Синадзугава|Sanemi Shinazugawa|Истребитель демонов|a|w|218
1|Гёмэй Химэдзима|Gyomei Himejima|Истребитель демонов|e|t|219
1|Мукиро Токито|Muichiro Tokito|Истребитель демонов|a|a|220
1|Кокушибо|Kokushibo|Истребитель демонов|d|w|221
1|Аказа|Akaza|Истребитель демонов|d|w|222
1|Дома|Doma|Истребитель демонов|l|m|223
1|Даки|Daki|Истребитель демонов|d|a|224
1|Канао Цуюри|Kanao Tsuyuri|Истребитель демонов|f|a|225
1|Райнер Браун|Reiner Braun|Атака титанов|e|t|226
1|Зик Йегер|Zeke Yeager|Атака титанов|e|m|227
1|Ханджи Зоэ|Hange Zoe|Атака титанов|f|m|228
1|Жан Кирштейн|Jean Kirstein|Атака титанов|e|w|229
1|Саша Браус|Sasha Blouse|Атака титанов|a|a|230
1|Энни Леонхарт|Annie Leonhart|Атака титанов|w|a|231
1|История Рейсс|Historia Reiss|Атака титанов|l|s|232
1|Кенни Аккерман|Kenny Ackerman|Атака титанов|e|a|233
1|Очако Урарака|Ochaco Uraraka|Моя геройская академия|l|s|234
1|Тенья Иида|Tenya Iida|Моя геройская академия|a|a|235
1|Эйджиро Киришима|Eijiro Kirishima|Моя геройская академия|e|t|236
1|Момо Яойорозу|Momo Yaoyorozu|Моя геройская академия|l|s|237
1|Цую Асуи|Tsuyu Asui|Моя геройская академия|w|a|238
1|Томура Шигараки|Tomura Shigaraki|Моя геройская академия|d|m|239
1|Даби|Dabi|Моя геройская академия|f|a|240
1|Эндевор|Endeavor|Моя геройская академия|f|t|241
1|Хоукс|Hawks|Моя геройская академия|a|a|242
1|Химико Тога|Himiko Toga|Моя геройская академия|d|a|243
1|Леорио Парадинайт|Leorio Paradinight|Охотник х Охотник|l|s|244
1|Хролло Люцифер|Chrollo Lucilfer|Охотник х Охотник|d|a|245
1|Фэйтан Портор|Feitan Portor|Охотник х Охотник|d|a|246
1|Меруэм|Meruem|Охотник х Охотник|d|w|247
1|Айзек Нетеро|Isaac Netero|Охотник х Охотник|l|w|248
1|Иллуми Золдик|Illumi Zoldyck|Охотник х Охотник|d|a|249
1|Бискит Круэгер|Biscuit Krueger|Охотник х Охотник|l|m|250
1|Гинг Фрикс|Ging Freecss|Охотник х Охотник|e|w|251
1|Альфонс Элрик|Alphonse Elric|Стальной алхимик|e|t|252
1|Уинри Рокбелл|Winry Rockbell|Стальной алхимик|e|s|253
1|Риза Хоукай|Riza Hawkeye|Стальной алхимик|f|a|254
1|Лин Яо|Ling Yao|Стальной алхимик|l|w|255
1|Грид|Greed|Стальной алхимик|e|t|256
1|Оливье Мира Армстронг|Olivier Mira Armstrong|Стальной алхимик|w|t|257
1|Скар|Scar|Стальной алхимик|e|w|258
1|Рюк|Ryuk|Тетрадь смерти|d|m|259
1|Мису Амане|Misa Amane|Тетрадь смерти|l|s|260
1|Мелло|Mello|Тетрадь смерти|f|a|261
1|Нир|Near|Тетрадь смерти|l|m|262
1|Судзаку Куруруги|Suzaku Kururugi|Код Гиас|l|w|263
1|Каллен Кодзуки|Kallen Kozuki|Код Гиас|f|w|264
1|Эуфемия ли Британия|Euphemia li Britannia|Код Гиас|l|s|265
1|Шнайзель эль Британия|Schneizel el Britannia|Код Гиас|d|m|266
1|Фэй Валентайн|Faye Valentine|Ковбой Бибоп|d|a|267
1|Джет Блэк|Jet Black|Ковбой Бибоп|e|t|268
1|Рэдикал Эдвард|Radical Edward|Ковбой Бибоп|a|a|269
1|Каска|Casca|Берсерк|f|w|270
1|Химэно|Himeno|Человек-бензопила|d|m|271
1|Реза|Reze|Человек-бензопила|f|a|272
1|Кобэни Хигасияма|Kobeni Higashiyama|Человек-бензопила|w|t|273
1|Ангельский дьявол|Angel Devil|Человек-бензопила|l|s|274
1|Ёру|Yoru|Человек-бензопила|d|a|275
1|Кисибэ|Kishibe|Человек-бензопила|d|w|276
1|Нацу Драгнил|Natsu Dragneel|Хвост Феи|f|w|277
1|Люси Хартфилия|Lucy Heartfilia|Хвост Феи|l|s|278
1|Грей Фуллбастер|Gray Fullbuster|Хвост Феи|w|m|279
1|Эрза Скарлет|Erza Scarlet|Хвост Феи|f|w|280
1|Венди Марвелл|Wendy Marvell|Хвост Феи|a|s|281
1|Гажил Редфокс|Gajeel Redfox|Хвост Феи|a|t|282
1|Лаксус Дреяр|Laxus Dreyar|Хвост Феи|a|w|283
1|Мираджейн Штраусс|Mirajane Strauss|Хвост Феи|w|m|284
1|Серие|Serie|Провожающая в последний путь Фрирен|l|m|285
1|Убель|Ubel|Провожающая в последний путь Фрирен|a|m|286
1|Зайн|Sein|Провожающая в последний путь Фрирен|l|s|287
1|Беру|Beru|Поднятие уровня в одиночку|d|a|288
1|Беллион|Bellion|Поднятие уровня в одиночку|d|t|289
1|Го Гун-Хи|Go Gun-Hee|Поднятие уровня в одиночку|f|w|290
0|Томас Андре|Thomas Andre|Поднятие уровня в одиночку|e|t|291
0|Субару Нацуки|Subaru Natsuki|Re:Zero|d|s|292
0|Беатрис|Beatrice|Re:Zero|d|m|293
0|Райнхард ван Астрея|Reinhard van Astrea|Re:Zero|l|w|294
0|Роздаль Л. Мэйзерс|Roswaal L Mathers|Re:Zero|a|m|295
0|Круш Карстен|Crusch Karsten|Re:Zero|w|w|296
0|Кадзума Сато|Kazuma Sato|Коносуба|a|a|297
0|Даркнесс|Darkness|Коносуба|e|t|298
0|Вельдора Темпест|Veldora Tempest|О моём перерождении в слизь|a|t|299
0|Шуна|Shuna|О моём перерождении в слизь|l|s|300
0|Шион|Shion|О моём перерождении в слизь|d|w|301
0|Диабло|Diablo|О моём перерождении в слизь|d|m|302
0|Шалльтир Блудфоллен|Shalltear Bloodfallen|Оверлорд|d|a|303
0|Демиург|Demiurge|Оверлорд|f|m|304
0|Коцит|Cocytus|Оверлорд|w|w|305
0|Дамиан Десмонд|Damian Desmond|Семья шпиона|l|w|306
0|Юри Брайар|Yuri Briar|Семья шпиона|d|a|307
0|Канут|Canute|Сага о Винланде|l|s|308
0|Торкель|Thorkell|Сага о Винланде|e|t|309
0|Сиро Эмия|Shirou Emiya|Судьба|f|w|310
0|Арчер Эмия|Archer EMIYA|Судьба|f|a|311
0|Ку Хулин|Cu Chulainn|Судьба|w|w|312
0|Мордред|Mordred|Судьба|f|w|313
0|Жанна д'Арк|Jeanne d'Arc|Судьба|l|s|314
0|Маш Кирилайт|Mash Kyrielight|Судьба|l|t|315
0|Мерлин|Merlin|Семь смертных грехов|a|m|316
0|Тацуми|Tatsumi|Убийца Акамэ|e|w|317
0|Леоне|Leone|Убийца Акамэ|f|a|318
0|Майн|Mine|Убийца Акамэ|a|m|319
0|Куроме|Kurome|Убийца Акамэ|d|a|320
0|Серас Виктория|Seras Victoria|Хеллсинг|d|a|321
0|Мисато Кацураги|Misato Katsuragi|Евангелион|f|a|322
0|Каору Нагиса|Kaworu Nagisa|Евангелион|l|m|323
0|Гэндо Икари|Gendo Ikari|Евангелион|d|m|324
0|Мэйн|Maine|Киберпанк: Бегущие по краю|a|t|325
0|Адам Смэшер|Adam Smasher|Киберпанк: Бегущие по краю|f|t|326
0|Кикору Синомия|Kikoru Shinomiya|Синяя тюрьма|a|a|328
0|Аира Сиратори|Aira Shiratori|Синяя тюрьма|l|s|329
0|Сёэй Бароу|Shouei Barou|Синяя тюрьма|e|w|330
0|Рэо Микагэ|Reo Mikage|Синяя тюрьма|w|s|331
0|Хёма Тигири|Hyouma Chigiri|Синяя тюрьма|f|a|332
0|Саэ Итоси|Sae Itoshi|Синяя тюрьма|d|m|333
0|Ноэль Ноа|Noel Noa|Синяя тюрьма|l|t|334
0|Майкл Кайзер|Michael Kaiser|Синяя тюрьма|a|m|335
0|Артур Бойл|Arthur Boyle|Пламенная бригада|l|w|336
0|Айрис|Iris|Синяя тюрьма|l|s|337
0|Ноэлль Сильва|Noelle Silva|Чёрный клевер|w|m|338
0|Мимоза Вермилион|Mimosa Vermillion|Чёрный клевер|l|s|339
0|Нозель Сильва|Nozel Silva|Чёрный клевер|w|t|340
0|Юлиус Новахрон|Julius Novachrono|Чёрный клевер|l|m|341
0|Мереолеона Вермилион|Mereoleona Vermillion|Чёрный клевер|f|w|342
0|Дайан|Diane|Семь смертных грехов|e|t|343
0|Арлекин|Harlequin|Семь смертных грехов|d|a|344
0|Говер|Gowther|Семь смертных грехов|a|m|345
0|Элизабет Лионес|Elizabeth Liones|Семь смертных грехов|a|s|346
0|Эстаросса|Estarossa|Семь смертных грехов|f|w|347
0|Лифа|Leafa|Мастера Меча Онлайн|a|a|348
0|Силика|Silica|Мастера Меча Онлайн|w|a|349
0|Лизбет|Lisbeth|Мастера Меча Онлайн|f|w|350
0|Клейн|Klein|Мастера Меча Онлайн|f|w|351
0|Алиса Зуберг|Alice Zuberg|Мастера Меча Онлайн|l|w|352
0|Хидэёси Нагатика|Hideyoshi Nagachika|Токийский гуль|w|s|353
0|Сю Цукияма|Shu Tsukiyama|Токийский гуль|d|a|354
0|Дзюдзо Судзуя|Juuzou Suzuya|Токийский гуль|a|a|355
0|Кисё Арима|Kishou Arima|Токийский гуль|l|w|356
0|Сёё Хината|Shoyo Hinata|Волейбол!!|f|a|357
0|Тобио Кагэяма|Tobio Kageyama|Волейбол!!|a|m|358
0|Тэцуро Куроо|Tetsurou Kuroo|Волейбол!!|d|t|359
0|Кэй Цукисима|Kei Tsukishima|Волейбол!!|l|t|360
0|Тоору Ойкава|Tooru Oikawa|Волейбол!!|w|m|361
0|Котаро Бокуто|Koutarou Bokuto|Волейбол!!|l|w|362
0|Ю Нисиноя|Yuu Nishinoya|Волейбол!!|a|t|363
0|Тэцуя Куроко|Tetsuya Kuroko|Баскетбол Куроко|w|a|364
0|Тайга Кагами|Taiga Kagami|Баскетбол Куроко|f|w|365
0|Сейджуро Акаси|Seijuro Akashi|Баскетбол Куроко|f|m|366
0|Дайки Аомине|Daiki Aomine|Баскетбол Куроко|d|w|367
0|Рёта Кисе|Ryota Kise|Баскетбол Куроко|a|a|368
0|Ханамити Сакураги|Hanamichi Sakuragi|Слэм-данк|f|w|369
0|Каэдэ Руками|Kaede Rukawa|Слэм-данк|w|a|370
0|Хисаси Мицуи|Hisashi Mitsui|Слэм-данк|w|m|371
0|Юсукэ Урамэси|Yusuke Urameshi|Ю Ю Хакусё|l|w|372
0|Хиэй|Hiei|Ю Ю Хакусё|f|a|373
0|Курама|Kurama|Наруто|f|m|374
0|Гинтоки Саката|Gintoki Sakata|Гинтама|e|w|375
0|Кагура|Kagura|Гинтама|a|w|376
0|Тосиро Хиджиката|Toshiro Hijikata|Гинтама|d|w|377
0|Сого Окита|Sogo Okita|Гинтама|a|a|378
0|Синсукэ Такасуги|Shinsuke Takasugi|Гинтама|d|m|379
0|Симон|Simon|Гуррен-Лаганн|e|w|380
0|Камина|Kamina|Гуррен-Лаганн|f|w|381
0|Ёко Литтнер|Yoko Littner|Гуррен-Лаганн|f|m|382
0|Рюко Матой|Ryuko Matoi|Убей или будь убитым|f|w|383
0|Сацуки Кирюин|Satsuki Kiryuin|Убей или будь убитым|l|m|384
0|Мадока Канаме|Madoka Kaname|Мадока Магика|l|m|385
0|Хомура Акэми|Homura Akemi|Мадока Магика|d|m|386
0|Мами Томоэ|Mami Tomoe|Мадока Магика|l|m|387
0|Кёко Сакура|Kyoko Sakura|Мадока Магика|f|w|388
0|Ринтаро Окабэ|Rintaro Okabe|Врата Штейна|l|m|389
0|Курису Макисэ|Kurisu Makise|Врата Штейна|l|s|390
0|Маюри Сиина|Mayuri Shiina|Врата Штейна|l|s|391
0|Синья Когами|Shinya Kogami|Психо-паспорт|d|a|392
0|Сёго Макисима|Shogo Makishima|Психо-паспорт|d|m|393
0|Рэйгэн Аратака|Reigen Arataka|Моб Психо 100|l|s|394
0|Рицу Кагеяма|Ritsu Kageyama|Моб Психо 100|a|s|395
0|Фубуки|Fubuki|Ванпанчмен|a|m|396
0|Бэнг|Bang|Ванпанчмен|w|w|397
0|Гароу|Garou|Ванпанчмен|e|w|398
0|Кинг|King|Ванпанчмен|e|t|399
0|Соник Звуковой|Speed-o -Sound Sonic|Ванпанчмен|a|a|400
0|Борос|Boros|Ванпанчмен|d|m|401
0|Металлическая Бита|Metal Bat|Ванпанчмен|f|w|402
0|Сэнку Исигами|Senku Ishigami|Доктор Стоун|e|s|403
0|Ген Асагири|Gen Asagiri|Доктор Стоун|d|s|404
0|Цукаса Сисио|Tsukasa Shishio|Доктор Стоун|e|w|405
0|Мака Албарн|Maka Albarn|Пожиратель душ|l|w|406
0|Блэк Стар|Black Star|Пожиратель душ|a|a|407
0|Тайга Айсака|Taiga Aisaka|Торадора!|f|w|408
0|Хатиман Хикигая|Hachiman Hikigaya|Моя юношеская романтика|d|s|409
0|Маи Сакурадзима|Mai Sakurajima|Бунигайский кролик|a|m|410
0|Мицуха Миямидзу|Mitsuha Miyamizu|Твоё имя|w|s|411
0|Таки Татибана|Taki Tachibana|Твоё имя|w|w|412
0|Хина Амано|Hina Amano|Дитя погоды|w|s|413
0|Судзумэ Ивато|Suzume Iwato|Судзумэ закрывает двери|e|s|414
0|Габимару|Gabimaru|Адский рай|f|a|415
0|Аква Хосино|Aqua Hoshino|Ваша звезда|d|a|416
0|Руби Хосино|Ruby Hoshino|Ваша звезда|l|m|417
0|Хитори Гото|Hitori Gotoh|Одинокий рокер|l|s|418
0|Никидзи Ичидзи|Nijika Ijichi|Одинокий рокер|f|w|419
0|Рё Ямада|Ryo Yamada|Одинокий рокер|w|a|420
0|Тисато Нисикиги|Chisato Nishikigi|Лико Рикоис|f|a|421
0|Рудеус Грейрат|Rudeus Greyrat|Реинкарнация безработного|w|m|422
0|Эрис Бореас Грейрат|Eris Boreas Greyrat|Реинкарнация безработного|f|w|423
0|Сора|Sora|Но гейм но лайф|a|m|424
0|Сиро|Shiro|Но гейм но лайф|l|m|425
0|Тока Ятогами|Tohka Yatogami|Date A Live|l|w|426
0|Усаги Цукино|Usagi Tsukino|Сейлор Мун|l|m|427
0|Рей Хино|Rei Hino|Сейлор Мун|f|m|428
0|Ами Мидзуно|Ami Mizuno|Сейлор Мун|w|m|429
0|Макото Кино|Makoto Kino|Сейлор Мун|a|w|430
0|Минако Айно|Minako Aino|Сейлор Мун|l|a|431
0|Сакура Киномото|Sakura Kinomoto|Сакура — собирательница карт|a|m|432
0|Сяоран Ли|Syaoran Li|Сакура — собирательница карт|e|w|433
0|Эш Кетчум|Ash Ketchum|Покемон|l|w|434
0|Мисти|Misty|Покемон|w|s|435
0|Конан Эдогава|Conan Edogawa|Детектив Конан|l|a|436
0|Ран Мори|Ran Mouri|Детектив Конан|e|w|437
0|Хэйдзи Хаттори|Heiji Hattori|Детектив Конан|a|a|438
0|Кайто Кид|Kaito Kid|Детектив Конан|l|a|439
0|Ай Хайбара|Ai Haibara|Детектив Конан|d|s|440
0|Сюити Акаи|Shuichi Akai|Детектив Конан|d|a|441
0|Люпен III|Lupin III|Люпен III|a|a|442
0|Дайсукэ Дзигэн|Daisuke Jigen|Люпен III|e|a|443
0|Мотоко Кусанаги|Motoko Kusanagi|Призрак в доспехах|d|a|444
0|Сётаро Канэда|Shotaro Kaneda|Акира|f|w|445
0|Вэш Ураган|Vash the Stampede|Триган|e|w|446
0|Мугэн|Mugen|Самурай Чамплу|a|w|447
0|Дзин|Jin|Самурай Чамплу|w|w|448
0|Кэнсин Химура|Kenshin Himura|Бродяга Кэнсин|w|w|449
0|Каору Камия|Kaoru Kamiya|Бродяга Кэнсин|e|s|450
0|Хадзимэ Сайто|Hajime Saito|Бродяга Кэнсин|d|a|451
0|Инуяся|Inuyasha|Инуяся|f|w|452
0|Кагомэ Хигураси|Kagome Higurashi|Инуяся|l|s|453
0|Сэссёмару|Sesshomaru|Инуяся|a|w|454
0|Мироку|Miroku|Инуяся|e|m|455
0|Кикё|Kikyo|Инуяся|l|m|456
0|Тору Хонда|Tohru Honda|Корзинка фруктов|w|s|457
0|Кё Сома|Kyo Sohma|Корзинка фруктов|f|w|458
0|Тамаки Сува|Tamaki Suoh|Хост-клуб старшей школы Оран|l|s|459
0|Рин Окумура|Rin Okumura|Синий экзорцист|f|w|460
0|Лайос Тоуден|Laios Touden|Подземелье вкусностей|l|w|461
0|Марсиль Донато|Marcille Donato|Подземелье вкусностей|l|m|462
0|Сэнси|Senshi|Подземелье вкусностей|e|t|463
0|Рико|Riko|Созданный в Бездне|l|s|464
0|Рэг|Reg|Созданный в Бездне|f|t|465
0|Эмма|Emma|Обещанный Неверленд|l|s|466
0|Норман|Norman|Обещанный Неверленд|w|m|467
0|Хяккимару|Hyakkimaru|Дороро|d|w|468
0|Двадцать пятый Бам|Twenty-Fifth Bam|Бог башни|w|m|469
0|Рахиль|Rachel|Бог башни|l|s|470
0|Сид Кагэно|Cid Kagenou|Тень в диком мире|d|m|471
0|Альфа|Alpha|Тень в диком мире|d|a|472
0|Юи Хирасава|Yui Hirasawa|К-Он!|l|s|473
0|Мио Акияма|Mio Akiyama|К-Он!|d|s|474
0|Рицу Таинака|Ritsu Tainaka|К-Он!|f|w|475
0|Харухи Судзумия|Haruhi Suzumiya|Меланхолия Харухи Судзумии|l|m|476
0|Юки Нагато|Yuki Nagato|Меланхолия Харухи Судзумии|a|m|477
0|Кагуя Синомия|Kaguya Shinomiya|Госпожа Кагуя|l|m|478
0|Миюки Широгане|Miyuki Shirogane|Госпожа Кагуя|w|s|479
0|Тика Фудзивара|Chika Fujiwara|Госпожа Кагуя|f|s|480
0|Амуро Рэй|Amuro Ray|Мобильный воин Гандам|l|w|481
0|Чар Азнабл|Char Aznable|Мобильный воин Гандам|f|a|482
0|Юги Муто|Yugi Muto|Югио!|l|m|483
0|Сэто Кайба|Seto Kaiba|Югио!|w|m|484
0|Итика Накано|Ichika Nakano|Квинтэссенция квинтетов|l|s|485
0|Нино Накано|Nino Nakano|Квинтэссенция квинтетов|f|s|486
0|Мику Накано|Miku Nakano|Квинтэссенция квинтетов|w|s|487
0|Коёми Арараги|Koyomi Araragi|Моногатари|d|w|488
0|Хитаги Сэндзёгахара|Hitagi Senjougahara|Моногатари|e|a|489
0|Синобу Осино|Shinobu Oshino|Моногатари|d|m|490
0|Иппо Макуноути|Ippo Makunouchi|Первый шаг|w|w|491
0|Такуми Фудзивара|Takumi Fujiwara|Инициал Ди|a|a|492
0|Кэнсиро|Kenshiro|Кулак Северной звезды|e|w|493
0|Маш Бёрндэд|Mash Burnedead|Магия и мускулы|e|t|494
0|Манджиро Сано|Manjirou Sano|Токийские мстители|l|w|495
0|Такемити Ханагаки|Takemichi Hanagaki|Токийские мстители|f|w|496
0|Кэн Рюгудзи|Ken Ryuuguuji|Токийские мстители|f|t|497
0|Сиэль Фантомхайв|Ciel Phantomhive|Тёмный дворецкий|d|m|498
0|Себастьян Михаэлис|Sebastian Michaelis|Тёмный дворецкий|d|a|499
0|Гиро Цеппели|Gyro Zeppeli|Невероятные приключения ДжоДжо|e|w|500
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
    const [r, name, search, series, el, c, n] = line.split("|");
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
      num: Number(n),
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

export const CATALOG: CardDef[] = build().sort((a, b) => a.num - b.num);
/** Всего карт в коллекции */
export const CATALOG_SIZE = CATALOG.length;
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
