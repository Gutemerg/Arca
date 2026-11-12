// Biblioteca de exercícios por grupo muscular (os que você criar entram junto, em "Meus exercícios")
export const GRUPOS = {
  Peito: [
    'Supino reto com barra', 'Supino reto com halteres', 'Supino inclinado com barra', 'Supino inclinado com halteres',
    'Supino declinado', 'Supino na máquina', 'Crucifixo reto', 'Crucifixo inclinado', 'Crossover polia alta',
    'Crossover polia baixa', 'Peck deck (voador)', 'Flexão de braço', 'Mergulho nas paralelas (peito)'
  ],
  Costas: [
    'Puxada frente aberta', 'Puxada frente fechada (triângulo)', 'Puxada supinada', 'Barra fixa', 'Barra fixa supinada',
    'Remada curvada com barra', 'Remada unilateral com halter (serrote)', 'Remada baixa (triângulo)', 'Remada cavalinho',
    'Remada na máquina', 'Pulldown com corda', 'Levantamento terra', 'Hiperextensão lombar'
  ],
  Ombros: [
    'Desenvolvimento com barra', 'Desenvolvimento com halteres', 'Desenvolvimento na máquina', 'Desenvolvimento Arnold',
    'Elevação lateral com halteres', 'Elevação lateral na polia', 'Elevação frontal', 'Crucifixo invertido',
    'Face pull', 'Remada alta', 'Encolhimento com barra', 'Encolhimento com halteres'
  ],
  Bíceps: [
    'Rosca direta com barra', 'Rosca direta barra W', 'Rosca alternada com halteres', 'Rosca martelo',
    'Rosca concentrada', 'Rosca Scott', 'Rosca na polia', 'Rosca inclinada com halteres'
  ],
  Tríceps: [
    'Tríceps pulley (barra)', 'Tríceps corda', 'Tríceps testa', 'Tríceps francês', 'Tríceps coice',
    'Mergulho no banco', 'Supino fechado', 'Tríceps unilateral na polia'
  ],
  Pernas: [
    'Agachamento livre', 'Agachamento no Smith', 'Agachamento búlgaro', 'Agachamento sumô', 'Hack squat',
    'Leg press 45°', 'Leg press horizontal', 'Cadeira extensora', 'Mesa flexora', 'Cadeira flexora',
    'Stiff', 'Levantamento terra romeno', 'Afundo (passada)', 'Avanço com halteres', 'Cadeira adutora',
    'Cadeira abdutora'
  ],
  Glúteos: [
    'Elevação pélvica (hip thrust)', 'Glúteo na polia (coice)', 'Glúteo na máquina', 'Ponte de glúteo',
    'Abdução na polia', 'Step-up no banco'
  ],
  Panturrilha: [
    'Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press', 'Panturrilha unilateral'
  ],
  Abdômen: [
    'Abdominal supra', 'Abdominal infra', 'Abdominal na polia', 'Abdominal oblíquo', 'Prancha',
    'Prancha lateral', 'Elevação de pernas na barra', 'Abdominal bicicleta', 'Roda abdominal'
  ],
  Antebraço: ['Rosca punho', 'Rosca punho invertida', 'Farmer walk']
};

export const TIPOS = {
  musculacao: 'Musculação',
  corrida: 'Corrida',
  cardio: 'Cardio',
  funcional: 'Funcional',
  outro: 'Outro'
};

export const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Força estimada (1RM, fórmula de Epley)
export const umRM = (carga, reps) => (carga && reps ? Number(carga) * (1 + Number(reps) / 30) : 0);

export const kg = (n) => (n == null || n === '' ? '—' : `${String(Number(n)).replace('.', ',')} kg`);
