# 🚛 Trucker Path - Guia de Build iOS

## Pré-requisitos

### Hardware & Software
- **Mac** com macOS 13.0+ (Ventura ou superior)
- **Xcode 15.0+** (baixe da App Store)
- **Apple Developer Account** ($99/ano para publicar na App Store)
- **iPhone físico** ou simulador iOS 14.0+

### Contas Necessárias
1. **Mapbox Account**: https://account.mapbox.com/
   - Crie uma conta gratuita
   - Gere um **Access Token** público e um **Secret Token**

---

## 🔧 Passo 1: Configurar Mapbox Tokens

### 1.1 Obter tokens no Mapbox
1. Acesse https://account.mapbox.com/access-tokens/
2. Crie um **Public Token** (para uso no app)
3. Crie um **Secret Token** com escopos:
   - `downloads:read`
   - `styles:tiles`
   - `styles:read`

### 1.2 Configurar credenciais locais
Crie o arquivo `~/.netrc` (na pasta home do seu Mac):

```bash
touch ~/.netrc
chmod 600 ~/.netrc
```

Adicione o conteúdo:
```
machine api.mapbox.com
login mapbox
password YOUR_SECRET_TOKEN_HERE
```

---

## 📦 Passo 2: Clonar e Preparar o Projeto

```bash
# 1. Clone o repositório (exporte primeiro do Lovable para GitHub)
git clone https://github.com/SEU_USUARIO/trucker-pathfinder-buddy.git
cd trucker-pathfinder-buddy

# 2. Instale dependências Node
npm install

# 3. Adicione plataforma iOS
npx cap add ios

# 4. Build do projeto web
npm run build

# 5. Sincronize com iOS
npx cap sync ios
```

---

## 🍎 Passo 3: Configurar Projeto Xcode

### 3.1 Abrir no Xcode
```bash
npx cap open ios
```

### 3.2 Configurar Signing
1. Selecione o projeto **App** no navegador
2. Vá para **Signing & Capabilities**
3. Selecione seu **Team** (Apple Developer Account)
4. Altere o **Bundle Identifier** se necessário

### 3.3 Adicionar Mapbox Access Token
1. Abra `ios/App/App/Info.plist`
2. Localize a key `MBXAccessToken`
3. Substitua `$(MAPBOX_ACCESS_TOKEN)` pelo seu token público

Ou via Xcode:
1. Selecione o projeto
2. Vá para **Build Settings**
3. Procure "User-Defined"
4. Adicione: `MAPBOX_ACCESS_TOKEN` = `pk.eyJ1Ijo...`

---

## 📱 Passo 4: Instalar Dependências CocoaPods

```bash
cd ios/App

# Instale CocoaPods se não tiver
sudo gem install cocoapods

# Instale as dependências
pod install --repo-update

cd ../..
```

**⚠️ Importante**: Sempre abra o arquivo `.xcworkspace`, não o `.xcodeproj`

---

## 🏃 Passo 5: Build e Run

### Opção A: Simulador
1. No Xcode, selecione um simulador (ex: iPhone 15 Pro)
2. Pressione **⌘+R** ou clique em **▶ Play**

### Opção B: Dispositivo Físico
1. Conecte seu iPhone via USB
2. Confie no computador no iPhone
3. Selecione seu dispositivo no Xcode
4. Pressione **⌘+R**

**Nota**: Para navegação GPS real, você PRECISA de um dispositivo físico.

---

## 📤 Passo 6: Exportar IPA para TestFlight

### 6.1 Archive
1. No Xcode, vá para **Product → Archive**
2. Aguarde a compilação terminar
3. A janela **Organizer** abrirá automaticamente

### 6.2 Distribute
1. Selecione o archive mais recente
2. Clique em **Distribute App**
3. Escolha **App Store Connect** (para TestFlight)
4. Siga os passos e faça upload

### 6.3 TestFlight
1. Acesse https://appstoreconnect.apple.com
2. Vá para seu app → TestFlight
3. Adicione testadores internos/externos
4. Eles receberão um email para baixar via TestFlight

---

## 🔧 Troubleshooting

### Erro: "No such module 'MapboxNavigation'"
```bash
cd ios/App
pod deintegrate
pod cache clean --all
pod install --repo-update
```

### Erro: "MBXAccessToken not found"
Verifique se o token está no Info.plist ou nas Build Settings.

### Erro: "Signing certificate required"
1. Vá para Xcode → Preferences → Accounts
2. Adicione sua Apple ID
3. Baixe os certificados automaticamente

### Erro de permissão de localização
Verifique se as keys NSLocation* estão no Info.plist.

---

## 📋 Checklist Final

- [ ] Mapbox tokens configurados (~/.netrc e Info.plist)
- [ ] Projeto exportado para GitHub e clonado
- [ ] `npm install` executado
- [ ] `npx cap add ios` executado
- [ ] `pod install` executado sem erros
- [ ] Signing configurado no Xcode
- [ ] Background Modes habilitados (location, audio)
- [ ] Testado em dispositivo físico
- [ ] Archive criado para TestFlight

---

## 🔗 Links Úteis

- [Mapbox Navigation SDK iOS](https://docs.mapbox.com/ios/navigation/guides/)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [Apple Developer Portal](https://developer.apple.com)
- [App Store Connect](https://appstoreconnect.apple.com)

---

## 📱 Funcionalidades Implementadas

| Feature | Status |
|---------|--------|
| GPS Real (sem simulação) | ✅ |
| Snap-to-route 15m | ✅ |
| Voz PT-BR | ✅ |
| Ícone de caminhão | ✅ |
| POI Fuel Stations (Love's, Pilot, etc.) | ✅ |
| POI Weigh Stations | ✅ |
| Download offline (10km corridor) | ✅ |
| Background navigation | ✅ |
