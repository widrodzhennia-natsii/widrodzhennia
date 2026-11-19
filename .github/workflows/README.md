# Автоматизація GitHub Actions (`.github/workflows/`)

У цій папці містяться сценарії автоматичної перевірки та збірки застосунку:

- **`ci.yml`** — запускається автоматично при кожному `push` у `main`/`master`, при `pull_request` або вручну (`workflow_dispatch`):
  - перевіряє типи TypeScript (`npm run lint`);
  - виконує аудит меж інтерфейсу (`npm run audit:ui`);
  - збирає виробничий бандл (`npm run build`) та зберігає артефакт `dist-bundle`.
- **`deploy-pages.yml`** — ручний або автоматичний (після увімкнення тригера `push`) деплой статичного SPA-застосунку на **GitHub Pages** із автоматичним налаштуванням `--base` під назву репозиторію.
  - Щоб увімкнути публікацію в GitHub: перейдіть у **Settings → Pages → Build and deployment → Source: GitHub Actions** і запустіть сценарій зі вкладки **Actions**.
