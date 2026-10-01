# Biblioteca local do Ubisoft Connect

O Ghost importa a biblioteca do cliente oficial Ubisoft Connect no Windows pelo mesmo tipo de cache utilizado pela integração do Playnite.

1. Abra o Ubisoft Connect oficial e entre na conta desejada.
2. Aguarde o carregamento da biblioteca no cliente oficial.
3. No Ghost, abra a tela de contas e escolha **Importar do Ubisoft Connect**.
4. Para trazer novas compras, repita o carregamento no cliente oficial e escolha **Atualizar biblioteca** no Ghost.

A conexão aparece como **Biblioteca local · Ubisoft Connect**, com quantidade de jogos e data do cache. Esse método não autentica uma conta Ubisoft no Ghost. O cache pode representar a última conta usada no cliente e não comprova licença ou acesso atual.

A origem é `%LOCALAPPDATA%\Ubisoft Game Launcher\cache\configuration\configurations`. O Ghost lê esse arquivo, sem modificar o cache ou consultar arquivos de autenticação. O diretório antigo de instalação não é usado como fallback, para evitar importar um cache obsoleto.

DLCs, conteúdo ULC, registros sem configuração de execução e jogos que dependem de outra loja são excluídos. Jogos novos entram como desinstalados. Atualizações preservam os títulos, as capas, as descrições e as instalações já configuradas; o estado instalado exige que o executável registrado seja um arquivo existente. Ausência de cache, formato inválido ou leitura incompleta preservam a biblioteca anterior.

Desconectar remove os registros Ubisoft da biblioteca do Ghost e deixa o cliente oficial intacto. Instalação e execução continuam nos clientes oficiais; o fluxo existente de jogos conectados abre a página oficial da plataforma.

Referência de comportamento: [Playnite — Uplay troubleshooting](https://github.com/JosefNemec/PlayniteExtensions/wiki/Uplay-troubleshooting). Esquema de cache consultado: [Models/LocalCache.cs](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/UplayLibrary/Models/LocalCache.cs).
