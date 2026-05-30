# MAX RCM

CRM multiatendimento em React + Vite com Supabase e preparação para Evolution API.

## Variáveis de ambiente

Use `.env.example` como base e configure no ambiente local e na hospedagem:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica

VITE_PUBLIC_APP_URL=https://seudominio.com

VITE_EVOLUTION_URL=https://evolution.seudominio.com
VITE_EVOLUTION_API_KEY=sua-api-key-da-evolution
VITE_EVOLUTION_INSTANCE_NAME=maxcrm
VITE_EVOLUTION_API_PREFIX=
VITE_EVOLUTION_WEBHOOK_PATH=/webhooks/evolution
VITE_EVOLUTION_WEBHOOK_URL=https://seudominio.com/webhooks/evolution
```

Se sua Evolution usa prefixo, por exemplo `/api/v1`, preencha `VITE_EVOLUTION_API_PREFIX=/api/v1`.

## Domínio na hospedagem

1. No painel da hospedagem, aponte o domínio para o build do Vite.
2. Configure as mesmas variáveis `VITE_*` no ambiente de build.
3. Gere o build com `npm run build`.
4. Publique a pasta `dist`.
5. Use HTTPS no domínio, porque Evolution, Supabase Auth e navegador exigem origem segura para integrações confiáveis.

O arquivo `public/.htaccess` já está preparado para hospedagem Apache/Hostinger com React Router. Ele evita erro 404 ao abrir rotas como `/conversations`, `/team` ou `/settings` diretamente pelo navegador.

## Evolution API

A tela `Canais` salva canais do tipo `evolution`, testa a conexão da instância e copia/configura o webhook.

O envio em `Conversas` funciona assim:

- a mensagem sempre é salva no Supabase;
- se a conversa tiver um canal com `base_url`, `api_key` e `instance_name`, o CRM tenta enviar pela Evolution API;
- se a API falhar, o CRM avisa que a mensagem ficou salva localmente, mas não saiu pela Evolution.

## Webhook

Um frontend estático hospedado em domínio comum não recebe webhook sozinho. A URL `VITE_EVOLUTION_WEBHOOK_URL` deve apontar para um endpoint de backend, por exemplo:

- uma Supabase Edge Function;
- uma API Node/Express hospedada no seu servidor;
- uma rota serverless da sua hospedagem, se disponível.

Exemplo de URL:

```text
https://seudominio.com/webhooks/evolution
```

Esse endpoint deve receber eventos da Evolution, localizar/criar cliente e conversa no Supabase, e inserir mensagens na tabela `messages`.

Este repositório já inclui um exemplo em:

```text
supabase/functions/evolution-webhook/index.ts
```

Para usar essa função, publique com Supabase CLI e configure os secrets:

```bash
supabase functions deploy evolution-webhook
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
supabase secrets set EVOLUTION_CHANNEL_ID=id-do-canal-opcional
```

Depois use a URL gerada pela função como `VITE_EVOLUTION_WEBHOOK_URL`.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
```
