# Arca

Tudo da sua vida em um só lugar. PWA (Vite + JS puro) com banco Neon (Postgres), login Neon Auth e IA na captura.

## Como está montado

| Parte | Onde |
|---|---|
| Banco | Neon, projeto **Arca** (`purple-wildflower-59131126`), região São Paulo, banco `arca` |
| Login | Neon Auth (Google ou e-mail e senha) |
| Leitura e gravação | Neon Data API direto do navegador, com o JWT do usuário. Toda tabela tem RLS: cada usuário só vê o que é dele |
| IA da captura | `api/captura.js` (função da Vercel). Só interpreta a frase; quem grava é o app |
| Estrutura do banco | `db/migrations/0001_schema_inicial.sql` (já aplicada) |

## Rodar no computador

```bash
npm install
cp .env.example .env   # preencha ANTHROPIC_API_KEY se quiser testar a captura com `vercel dev`
npm run dev
```

## Publicar (Vercel, grátis)

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório (ela detecta Vite sozinha).
3. Em **Environment Variables**, cadastre as 4 variáveis do `.env.example`, com a sua chave da Anthropic em `ANTHROPIC_API_KEY`.
4. Depois do primeiro deploy, adicione o domínio do app (ex.: `https://arca-xyz.vercel.app`) como domínio confiável no Neon Auth.
5. No Android, abra o endereço no Chrome → menu ⋮ → **Instalar app**.

## Telas desta versão

- **Hoje**: alertas (contas, documentos, consultas), saldo do mês, tarefas e hábitos
- **Capturar**: texto ou voz → IA → grava na sala certa (com "Desfazer")
- **Finanças**: pizza por categoria, contas com "Paguei" (cria a próxima automaticamente), assinaturas, caixinhas, lançamentos
- **Documentos**: pastas, validade e aviso 30 dias antes
- **Salas**: as demais salas já recebem dados pela captura; as telas vêm nas próximas etapas

## Conta bancária (Open Finance)

A Arca puxa a conta corrente pelo **Meu Pluggy** (gratuito para as suas próprias contas).

1. Crie a conta em [pluggy.ai](https://pluggy.ai), crie uma aplicação e adicione o conector **MeuPluggy**.
2. Em [meu.pluggy.ai](https://meu.pluggy.ai), conecte o banco pelo Open Finance (faça isso durante o teste grátis).
3. Na Netlify, cadastre `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` (marque como secretas) e faça um novo deploy.
4. No painel da Pluggy → aplicação → **Ir para Demo** → autorize o Meu Pluggy → **Copiar Item ID**.
5. Na Arca, em **Finanças → Conectar conta**, cole o Item ID.

A função `/api/banco-sync` lê só contas correntes, ignora lançamentos pendentes, nunca duplica
(`externo_id`) e grava com o JWT do usuário, respeitando o RLS. O app sincroniza sozinho ao abrir
Finanças (no máximo a cada 12 h) e pelo botão **Sincronizar**.
