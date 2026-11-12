// Execução animada de cada exercício: duas fotos (início e fim do movimento) alternando.
// Fotos do free-exercise-db (github.com/yuhonas/free-exercise-db, domínio público), guardadas em /public/exec.
const BASE = '/exec/';

// nome → [foto, equipamento]
const MAPA = {
  "Supino reto com barra": ["Barbell_Bench_Press_-_Medium_Grip", "Barra"],
  "Supino reto com halteres": ["Dumbbell_Bench_Press", "Halteres"],
  "Supino inclinado com barra": ["Barbell_Incline_Bench_Press_-_Medium_Grip", "Barra"],
  "Supino inclinado com halteres": ["Incline_Dumbbell_Press", "Halteres"],
  "Supino declinado": ["Decline_Barbell_Bench_Press", "Barra"],
  "Supino na máquina": ["Machine_Bench_Press", "Máquina"],
  "Crucifixo reto": ["Dumbbell_Flyes", "Halteres"],
  "Crucifixo inclinado": ["Incline_Dumbbell_Flyes", "Halteres"],
  "Crossover polia alta": ["Cable_Crossover", "Polia"],
  "Crossover polia baixa": ["Low_Cable_Crossover", "Polia"],
  "Peck deck (voador)": ["Butterfly", "Máquina"],
  "Flexão de braço": ["Pushups", "Peso corporal"],
  "Mergulho nas paralelas (peito)": ["Dips_-_Chest_Version", "Paralelas"],
  "Puxada frente aberta": ["Wide-Grip_Lat_Pulldown", "Polia"],
  "Puxada frente fechada (triângulo)": ["V-Bar_Pulldown", "Polia"],
  "Puxada supinada": ["Underhand_Cable_Pulldowns", "Polia"],
  "Barra fixa": ["Pullups", "Barra fixa"],
  "Barra fixa supinada": ["Chin-Up", "Barra fixa"],
  "Remada curvada com barra": ["Bent_Over_Barbell_Row", "Barra"],
  "Remada unilateral com halter (serrote)": ["One-Arm_Dumbbell_Row", "Halteres"],
  "Remada baixa (triângulo)": ["Seated_Cable_Rows", "Polia"],
  "Remada cavalinho": ["T-Bar_Row_with_Handle", "Barra"],
  "Remada na máquina": ["Leverage_Iso_Row", "Máquina"],
  "Pulldown com corda": ["Rope_Straight-Arm_Pulldown", "Polia"],
  "Levantamento terra": ["Barbell_Deadlift", "Barra"],
  "Hiperextensão lombar": ["Hyperextensions_Back_Extensions", "Banco"],
  "Desenvolvimento com barra": ["Barbell_Shoulder_Press", "Barra"],
  "Desenvolvimento com halteres": ["Dumbbell_Shoulder_Press", "Halteres"],
  "Desenvolvimento na máquina": ["Machine_Shoulder_Military_Press", "Máquina"],
  "Desenvolvimento Arnold": ["Arnold_Dumbbell_Press", "Halteres"],
  "Elevação lateral com halteres": ["Side_Lateral_Raise", "Halteres"],
  "Elevação lateral na polia": ["Cable_Seated_Lateral_Raise", "Polia"],
  "Elevação frontal": ["Front_Dumbbell_Raise", "Halteres"],
  "Crucifixo invertido": ["Reverse_Flyes", "Halteres"],
  "Face pull": ["Face_Pull", "Polia"],
  "Remada alta": ["Upright_Barbell_Row", "Barra"],
  "Encolhimento com barra": ["Barbell_Shrug", "Barra"],
  "Encolhimento com halteres": ["Dumbbell_Shrug", "Halteres"],
  "Rosca direta com barra": ["Barbell_Curl", "Barra"],
  "Rosca direta barra W": ["EZ-Bar_Curl", "Barra W"],
  "Rosca alternada com halteres": ["Dumbbell_Alternate_Bicep_Curl", "Halteres"],
  "Rosca martelo": ["Hammer_Curls", "Halteres"],
  "Rosca concentrada": ["Concentration_Curls", "Halteres"],
  "Rosca Scott": ["Preacher_Curl", "Barra"],
  "Rosca na polia": ["Standing_Biceps_Cable_Curl", "Polia"],
  "Rosca inclinada com halteres": ["Incline_Dumbbell_Curl", "Halteres"],
  "Tríceps pulley (barra)": ["Triceps_Pushdown", "Polia"],
  "Tríceps corda": ["Triceps_Pushdown_-_Rope_Attachment", "Polia"],
  "Tríceps testa": ["EZ-Bar_Skullcrusher", "Barra W"],
  "Tríceps francês": ["Standing_Dumbbell_Triceps_Extension", "Halteres"],
  "Tríceps coice": ["Tricep_Dumbbell_Kickback", "Halteres"],
  "Mergulho no banco": ["Bench_Dips", "Banco"],
  "Supino fechado": ["Close-Grip_Barbell_Bench_Press", "Barra"],
  "Tríceps unilateral na polia": ["Cable_One_Arm_Tricep_Extension", "Polia"],
  "Agachamento livre": ["Barbell_Full_Squat", "Barra"],
  "Agachamento no Smith": ["Smith_Machine_Squat", "Smith"],
  "Agachamento búlgaro": ["Split_Squat_with_Dumbbells", "Halteres"],
  "Agachamento sumô": ["Plie_Dumbbell_Squat", "Halteres"],
  "Hack squat": ["Hack_Squat", "Máquina"],
  "Leg press 45°": ["Leg_Press", "Máquina"],
  "Leg press horizontal": ["Narrow_Stance_Leg_Press", "Máquina"],
  "Cadeira extensora": ["Leg_Extensions", "Máquina"],
  "Mesa flexora": ["Lying_Leg_Curls", "Máquina"],
  "Cadeira flexora": ["Seated_Leg_Curl", "Máquina"],
  "Stiff": ["Stiff-Legged_Barbell_Deadlift", "Barra"],
  "Levantamento terra romeno": ["Romanian_Deadlift", "Barra"],
  "Afundo (passada)": ["Barbell_Walking_Lunge", "Barra"],
  "Avanço com halteres": ["Dumbbell_Lunges", "Halteres"],
  "Cadeira adutora": ["Cable_Hip_Adduction", "Máquina"],
  "Elevação pélvica (hip thrust)": ["Barbell_Hip_Thrust", "Barra"],
  "Glúteo na polia (coice)": ["One-Legged_Cable_Kickback", "Polia"],
  "Glúteo na máquina": ["Glute_Kickback", "Máquina"],
  "Ponte de glúteo": ["Barbell_Glute_Bridge", "Barra"],
  "Step-up no banco": ["Dumbbell_Step_Ups", "Halteres"],
  "Panturrilha em pé": ["Standing_Calf_Raises", "Máquina"],
  "Panturrilha sentado": ["Seated_Calf_Raise", "Máquina"],
  "Panturrilha no leg press": ["Calf_Press_On_The_Leg_Press_Machine", "Máquina"],
  "Panturrilha unilateral": ["Dumbbell_Seated_One-Leg_Calf_Raise", "Halteres"],
  "Abdominal supra": ["Crunches", "Peso corporal"],
  "Abdominal infra": ["Reverse_Crunch", "Peso corporal"],
  "Abdominal na polia": ["Cable_Crunch", "Polia"],
  "Abdominal oblíquo": ["Oblique_Crunches", "Peso corporal"],
  "Prancha": ["Plank", "Peso corporal"],
  "Prancha lateral": ["Side_Bridge", "Peso corporal"],
  "Elevação de pernas na barra": ["Hanging_Leg_Raise", "Barra fixa"],
  "Abdominal bicicleta": ["Cross-Body_Crunch", "Peso corporal"],
  "Roda abdominal": ["Ab_Roller", "Roda"],
  "Rosca punho": ["Palms-Up_Barbell_Wrist_Curl_Over_A_Bench", "Barra"],
  "Rosca punho invertida": ["Palms-Down_Wrist_Curl_Over_A_Bench", "Barra"],
  "Farmer walk": ["Farmers_Walk", "Halteres"]
};

export const temExecucao = (nome) => !!MAPA[nome];
export const equipamento = (nome) => MAPA[nome]?.[1] || '';
export const foto = (nome) => (MAPA[nome] ? `${BASE}${MAPA[nome][0]}_0.webp` : '');

// HTML da animação (ou vazio se o exercício não tiver fotos, ex.: criado por você)
export function execucao(nome, tamanho = 'grande') {
  const id = MAPA[nome]?.[0];
  if (!id) return '';
  return `<span class="exec ${tamanho}" role="img" aria-label="Execução: ${nome.replace(/"/g, '')}">
    <img src="${BASE}${id}_0.webp" alt="" loading="lazy" decoding="async">
    <img src="${BASE}${id}_1.webp" alt="" loading="lazy" decoding="async">
  </span>`;
}
