// Valores públicos (não são segredos): endereços do Neon e Client ID da aplicação Arca na Pluggy.
// Ficam no código para as funções funcionarem mesmo se as variáveis do painel da hospedagem sumirem.
// Segredos (PLUGGY_CLIENT_SECRET, ANTHROPIC_API_KEY) continuam só nas variáveis da hospedagem.
const PADRAO = {
  NEON_AUTH_JWKS_URL: 'https://ep-misty-hill-b62dcvtr.neonauth.c-2.sa-east-1.aws.neon.tech/arca/auth/.well-known/jwks.json',
  NEON_DATA_API_URL: 'https://ep-misty-hill-b62dcvtr.apirest.c-2.sa-east-1.aws.neon.tech/arca/rest/v1',
  PLUGGY_CLIENT_ID: 'f0e1a071-e08d-4109-9980-afa17a3f2097'
};

// Junta as variáveis da hospedagem com os valores públicos padrão
export function comPadroes(env) {
  return new Proxy({}, {
    get: (_, k) => {
      const v = env?.[k];
      return v != null && v !== '' ? v : PADRAO[k];
    }
  });
}
