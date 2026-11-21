import * as IconComponents from '@element-plus/icons-vue'

const weaponTypeNames = new Set([
  // Genshin & BH3
  '武器', 'Weapon', '무기', 'Arma', 'Arme', 'Оружие', 'อาวุธ', 'Vũ Khí', 'Waffe', 'Senjata', 'Silah',
  // Star Rail
  '光锥', '光錐', 'Light Cone', 'Lichtkegel', 'Conos de luz', 'Cono de luz', 'cônes de lumière', 'Cône de lumière', '光円錐', '광추', 'Cones de Luz', 'Световые конусы', 'Световой конус', 'Nón Ánh Sáng', 'ไลท์โคน',
  // ZZZ
  '音擎', 'W-Engine', 'W-Engines', '音動機', 'W-엔진', 'W-Motor', 'Moteur-W', 'Амплификатор',
  // BH3 Stigmata
  '圣痕', '聖痕', 'Stigma', 'Stigmata', '성흔'
])

const characterTypeNames = new Set([
  // Genshin, Star Rail & BH3
  '角色', 'Character', '캐릭터', 'キャラクター', 'キャラ', 'Personaje', 'Personajes', 'Personnage', 'Personnages', 'Персонажи', 'Персонаж', 'ตัวละคร', 'Nhân Vật', 'Figur', 'Karakter', 'Personagem', 'Personagens', 'Personaggio',
  '女武神', 'Battlesuit', 'Valkyrie', '协同者', '協同者', 'AstralOp', '人偶', '武装人偶', 'ELF',
  // ZZZ
  '代理人', 'Agent', 'Agents', 'エージェント', '에이전트', 'Агент', 'Người Đại Diện', 'Agente'
])

const bangbooTypeNames = new Set([
  '邦布', 'Bangboo', 'ボンプ', '「Bangboo」', 'Банбу', 'Băng Bố', 'บางบู'
])

const isCharacter = (name) => characterTypeNames.has(name)
const isWeapon = (name) => weaponTypeNames.has(name)
const isBangboo = (name) => bangbooTypeNames.has(name)

const IconInstaller = (app) => {
  Object.values(IconComponents).forEach(component => {
    app.component(component.name, component)
  })
}

export {
  isWeapon,
  isCharacter,
  isBangboo,
  IconInstaller
}
