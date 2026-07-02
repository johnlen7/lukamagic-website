# Luka Magic — Website

Landing page de vendas do Luka Magic Tips (clube VIP de análises esportivas no Telegram).

## Rodar localmente

Site estático, sem build. Servir a pasta com qualquer servidor HTTP:

```bash
python -m http.server 4173
# abre http://localhost:4173
```

Ou abrir `index.html` direto no navegador.

## Estrutura

```
index.html                          página (entrada)
assets/lukamagic/site-quality/      imagens (hero, comunidade, CTA, prints, retrato)
.nojekyll                           evita processamento Jekyll no GitHub Pages
```

## Publicar (GitHub Pages)

1. Repo: `johnlen7/lukamagic-website`
2. Settings → Pages → Source: branch `main`, pasta `/ (root)`
3. Site fica em `https://johnlen7.github.io/lukamagic-website/`

Para domínio próprio (ex.: `lukamagic.com.br`), adicionar arquivo `CNAME` com o domínio e configurar o DNS.

## Notas

- Fontes carregadas via Google Fonts (Archivo, Archivo Black, Spline Sans Mono) — exige internet. Para offline/performance, self-hostar as fontes.
- Dados do boletim e do histórico são **demonstrativos**. Substituir por registro real antes de tráfego pago.
- Links de checkout dos planos estão como `#` — apontar para os checkouts reais (Kirvano).
- Antes de produção: adicionar páginas de Termos, Privacidade, Reembolso e Jogo Responsável.
