"""Build/test isolated engine bundles. Run in a disposable Python venv on Windows x64."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Ghost-engine-validation', 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scrapling', default='0.4.15')
    parser.add_argument('--obscura', default='0.2.3')
    parser.add_argument('--out', default='public/engine-bundles')
    args = parser.parse_args()
    if sys.platform != 'win32' or os.environ.get('PROCESSOR_ARCHITECTURE', '').lower() != 'amd64':
        raise RuntimeError('Initial engine bundles target Windows x64 only')
    for value in [args.scrapling, args.obscura]:
        if not re.fullmatch(r'\d+\.\d+\.\d+', value):
            raise ValueError('Stable release required')
    output = Path(args.out).resolve()
    output.mkdir(parents=True, exist_ok=True)
    worker = Path(__file__).with_name('scrapling_worker.py').resolve()
    subprocess.run([sys.executable, str(worker), '--self-test'], check=True)
    from importlib.metadata import version
    if version('scrapling') != args.scrapling:
        raise RuntimeError('Install the requested Scrapling version in the build venv first')
    releases = []
    with tempfile.TemporaryDirectory(prefix='ghost-engines-') as folder:
        temporary = Path(folder)
        subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir',
                        '--name', 'ghost-scrapling', '--copy-metadata', 'scrapling',
                        '--collect-all', 'scrapling', '--distpath', str(temporary / 'dist'),
                        '--workpath', str(temporary / 'work'), '--specpath', str(temporary), str(worker)], check=True)
        binary_root = temporary / 'dist' / 'ghost-scrapling'
        subprocess.run([str(binary_root / 'ghost-scrapling.exe'), '--self-test'], check=True)
        licenses = binary_root / 'THIRD_PARTY_LICENSES.txt'
        from importlib.metadata import distributions
        notices = []
        for package in distributions():
            for file in package.files or []:
                if 'license' in str(file).lower() and str(file).lower().endswith(('.txt', '.md', 'license')):
                    try:
                        notices.append(f"\n--- {package.metadata['Name']} ---\n" + package.locate_file(file).read_text(encoding='utf-8'))
                    except (OSError, UnicodeError):
                        pass
        licenses.write_text('\n'.join(notices), encoding='utf-8')
        zip_path = Path(shutil.make_archive(str(temporary / 'scrapling'), 'zip', binary_root))
        digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
        shutil.copy2(zip_path, output / (digest + '.zip'))
        releases.append({'id': 'scrapling', 'version': args.scrapling,
                         'url': f'https://github.com/alazter/GhostGamesLauncher/releases/download/engines-scrapling-{args.scrapling}/{digest}.zip',
                         'sha256': digest, 'executable': 'ghost-scrapling.exe'})

        release = json.loads(get(f'https://api.github.com/repos/h4ckf0r0day/obscura/releases/tags/v{args.obscura}'))
        asset = next(item for item in release['assets'] if item['name'] == 'obscura-x86_64-windows.zip')
        data = get(asset['browser_download_url'])
        digest = hashlib.sha256(data).hexdigest()
        if asset.get('digest') != 'sha256:' + digest:
            raise RuntimeError('Obscura official digest mismatch or missing')
        zip_path = output / (digest + '.zip')
        zip_path.write_bytes(data)
        browser_root = temporary / 'obscura'
        with zipfile.ZipFile(zip_path) as archive:
            for item in archive.infolist():
                if not (browser_root / item.filename).resolve().is_relative_to(browser_root.resolve()):
                    raise RuntimeError('Unsafe archive')
            archive.extractall(browser_root)
        binary = next(browser_root.rglob('obscura.exe'))
        reported = subprocess.check_output([str(binary), '--version'], text=True, timeout=20)
        if args.obscura not in reported:
            raise RuntimeError('Obscura version mismatch')
        # Local fixture verifies JavaScript and DOM extraction without touching game sites.
        fixture = temporary / 'fixture.html'
        fixture.write_text('<html><body><div id="result"></div><script>document.getElementById("result").textContent="GHOST_ENGINE_OK"</script></body></html>')
        from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
        from functools import partial
        from threading import Thread
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(temporary)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            result = subprocess.check_output([str(binary), 'fetch', f'http://127.0.0.1:{server.server_port}/fixture.html',
                                              '--allow-private-network', '--eval', 'document.getElementById("result").textContent'], text=True, timeout=30)
            if 'GHOST_ENGINE_OK' not in result:
                raise RuntimeError('Obscura DOM/JavaScript compatibility test failed')
        finally:
            server.shutdown()
            server.server_close()
        releases.append({'id': 'obscura', 'version': args.obscura, 'url': asset['browser_download_url'],
                         'sha256': digest, 'executable': binary.relative_to(browser_root).as_posix()})
    for release in releases:
        release.update(platform='win32', arch='x64', minGhostVersion='0.3.0-beta', protocol=1)
    temporary_catalog = output / 'catalog.tmp'
    temporary_catalog.write_text(json.dumps({'releases': releases, 'rules': json.loads(Path(__file__).with_name('source-rules.json').read_text()), 'integration': os.environ.get('ENGINE_INTEGRATION', 'local')}, indent=2), encoding='utf-8')
    temporary_catalog.replace(output / 'catalog.json')
    keep = {release['sha256'] + '.zip' for release in releases}
    for artifact in output.glob('*.zip'):
        if re.fullmatch(r'[a-f0-9]{64}\.zip', artifact.name) and artifact.name not in keep:
            artifact.unlink()
    print('Verified engine bundles:', output)


if __name__ == '__main__':
    main()
