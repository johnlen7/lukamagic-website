"""Visual and layout audit for the Luka Magic landing page.

Run through the webapp-testing skill's server helper, for example:
python with_server.py --server "python -m http.server 4173 --bind 127.0.0.1" \
  --port 4173 -- python tests/ui_audit.py --base-url http://127.0.0.1:4173
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


SECTIONS = [
    ("00-hero", ".hero"),
    ("01-vantagens", "#como"),
    ("02-resultados", "#resultados"),
    ("03-comunidade", ".community"),
    ("04-depoimentos", "#depoimentos"),
    ("05-vip", "#recebe"),
    ("06-comparativo", "#comparativo"),
    ("07-luka", "#luka"),
    ("08-planos", "#planos"),
    ("09-faq", "#faq"),
    ("10-final", ".final"),
    ("11-footer", "footer"),
]

VIEWPORTS = {
    "desktop-1440": {"width": 1440, "height": 900},
    "desktop-1280": {"width": 1280, "height": 800},
    "mobile-390": {"width": 390, "height": 844},
    "mobile-360": {"width": 360, "height": 800},
}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")


def save_report(output: Path, report: dict) -> Path:
    report_path = output / "report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report_path


def collect_layout(page: Page) -> dict:
    return page.evaluate(
        """
        () => {
          const skipOverflow = (el) => el.closest(
            '.plantao-track,.plantao-set,.voices-track,.voices-set,' +
            '.cursor-ring,.cursor-dot,.preloader,[aria-hidden="true"]'
          );
          const shown = (el, css) => css.display !== 'none' &&
            css.visibility !== 'hidden' && parseFloat(css.opacity || '1') > 0.01 &&
            el.getClientRects().length > 0;
          const label = (el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            class: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
            text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 150)
          });

          const viewportOverflow = [];
          const clippedText = [];
          const tinyTargets = [];

          for (const el of document.querySelectorAll('body *')) {
            const css = getComputedStyle(el);
            if (!shown(el, css)) continue;
            const r = el.getBoundingClientRect();
            if (!skipOverflow(el) && r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) {
              viewportOverflow.push({...label(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)});
            }

            const hasOwnText = [...el.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
            );
            const clipsX = ['hidden', 'clip'].includes(css.overflowX) && el.scrollWidth > el.clientWidth + 1;
            const clipsY = ['hidden', 'clip'].includes(css.overflowY) && el.scrollHeight > el.clientHeight + 1;
            if (hasOwnText && !skipOverflow(el) && (clipsX || clipsY)) {
              clippedText.push({
                ...label(el), clipsX, clipsY,
                client: [el.clientWidth, el.clientHeight],
                scroll: [el.scrollWidth, el.scrollHeight]
              });
            }

            if (el.matches('a,button,summary') && r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
              tinyTargets.push({...label(el), size: [Math.round(r.width), Math.round(r.height)]});
            }
          }

          return {
            viewport: [innerWidth, innerHeight],
            document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            viewportOverflow: viewportOverflow.slice(0, 60),
            clippedText: clippedText.slice(0, 60),
            tinyTargets: tinyTargets.slice(0, 60),
          };
        }
        """
    )


def wait_for_preloader(page: Page, started: float) -> int:
    try:
        page.locator(".preloader").wait_for(state="detached", timeout=8_000)
    except Exception:
        page.locator(".preloader").wait_for(state="hidden", timeout=1_000)
    return round((time.perf_counter() - started) * 1000)


def sample_hero_timing(page: Page, started: float) -> dict:
    selectors = [
        ".hero .kicker",
        ".hero h1",
        ".hero .lead",
        ".hero .actions .btn:first-child",
        ".hero .actions .btn:nth-child(2)",
        ".hero .fineprint",
    ]
    result = {}
    for selector in selectors:
        try:
            page.wait_for_function(
                """selector => {
                  const el = document.querySelector(selector);
                  if (!el) return false;
                  const css = getComputedStyle(el);
                  return parseFloat(css.opacity || '1') >= .98 && css.visibility !== 'hidden';
                }""",
                arg=selector,
                timeout=8_000,
            )
            result[selector] = round((time.perf_counter() - started) * 1000)
        except Exception:
            result[selector] = None
    return result


def audit_viewport(page: Page, name: str, output: Path, base_url: str) -> dict:
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    started = time.perf_counter()
    for attempt in range(2):
        try:
            page.goto(base_url, wait_until="commit", timeout=30_000)
            break
        except Exception:
            if attempt:
                raise
            page.wait_for_timeout(350)
    page.locator(".preloader").wait_for(state="attached", timeout=3_000)
    preloader_ms = wait_for_preloader(page, started)
    page.wait_for_load_state("networkidle", timeout=30_000)
    hero_timing = sample_hero_timing(page, started)
    page.wait_for_timeout(450)

    shot_dir = output / name
    shot_dir.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(shot_dir / "00-full-page.png"), full_page=True)

    section_metrics = {}
    for section_name, selector in SECTIONS:
        locator = page.locator(selector).first
        animated = locator.locator(".reveal:visible,.stagger > :visible")
        for index in range(animated.count()):
            animated.nth(index).scroll_into_view_if_needed()
            page.wait_for_timeout(65)
        locator.scroll_into_view_if_needed()
        page.wait_for_timeout(1_150)
        box = locator.bounding_box()
        section_metrics[selector] = {
            "box": {key: round(value, 1) for key, value in box.items()} if box else None,
            "opacity": locator.evaluate("el => getComputedStyle(el).opacity"),
        }
        locator.screenshot(path=str(shot_dir / f"{slug(section_name)}.png"))

    # Exercise the two interactive components in both responsive layouts.
    faq = page.locator("#faq")
    faq.scroll_into_view_if_needed()
    page.locator(".faq-list summary").first.click()
    page.wait_for_timeout(550)
    faq.screenshot(path=str(shot_dir / "09-faq-open.png"))

    proof = page.locator("#resultados")
    proof.scroll_into_view_if_needed()
    page.locator("[data-proof-open]").first.click()
    page.wait_for_timeout(550)
    modal_open = page.locator("[data-proof-modal]").evaluate("el => el.open")
    page.locator("[data-proof-modal]").screenshot(path=str(shot_dir / "02-proof-modal.png"))
    page.locator(".proof-modal-close").click()

    # Trigger every reveal before the final layout pass.
    for _, selector in SECTIONS:
        page.locator(selector).first.scroll_into_view_if_needed()
        page.wait_for_timeout(120)
    page.wait_for_timeout(1_100)
    layout = collect_layout(page)
    hero_cta = page.locator(".hero [data-cta-mobile-persistent]")
    hero_cta.scroll_into_view_if_needed()
    page.wait_for_timeout(900)
    cta_modes = page.evaluate(
        """() => {
          const hero = document.querySelector('.hero [data-cta-mobile-persistent]');
          return {
            mobile:matchMedia('(max-width:640px)').matches,
            heroSignal:hero?.classList.contains('cta-signal') || false,
            heroPersistent:hero?.classList.contains('cta-persistent') || false
          };
        }"""
    )

    return {
        "viewport": VIEWPORTS[name],
        "preloaderMs": preloader_ms,
        "heroVisibleMsFromNavigationStart": hero_timing,
        "modalOpened": modal_open,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "sections": section_metrics,
        "layout": layout,
        "ctaModes": cta_modes,
    }


def audit_mobile_entry_timing(page: Page, output: Path, base_url: str) -> dict:
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    for attempt in range(2):
        try:
            page.goto(base_url, wait_until="commit", timeout=10_000)
            break
        except Exception:
            if attempt:
                raise
            page.wait_for_timeout(350)
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        page.locator("main").wait_for(state="attached", timeout=3_000)
    page.wait_for_function("() => typeof window.LUKA !== 'undefined'", timeout=15_000)
    try:
        page.locator(".preloader").wait_for(state="detached", timeout=4_000)
    except Exception:
        pass

    def place_at_read_line(selector: str, fraction: float = .68) -> None:
        page.evaluate(
            """({selector,fraction}) => {
              const el = document.querySelector(selector);
              const top = el.getBoundingClientRect().top + scrollY;
              scrollTo({top:Math.max(0,top - innerHeight * fraction),behavior:'instant'});
            }""",
            {"selector": selector, "fraction": fraction},
        )

    def opacity(selector: str) -> float:
        return float(page.locator(selector).evaluate("el => getComputedStyle(el).opacity"))

    first = "#como .how article:nth-child(1)"
    second = "#como .how article:nth-child(2)"
    third = "#como .how article:nth-child(3)"

    motion_dir = output / "motion"
    motion_dir.mkdir(parents=True, exist_ok=True)

    nav_cta = page.locator(".nav [data-cta-persistent]")
    page.wait_for_function(
        "() => document.querySelector('.nav [data-cta-persistent]')?.classList.contains('cta-persistent')",
        timeout=3_500,
    )
    nav_persistent = nav_cta.evaluate(
        """el => {
          const box = el.getBoundingClientRect();
          const frame = getComputedStyle(el,'::after');
          return {
            armed:el.classList.contains('cta-persistent'),
            visible:box.width > 0 && box.height >= 44 && getComputedStyle(el).display !== 'none',
            width:Math.round(box.width),height:Math.round(box.height),
            animationName:frame.animationName,animationDuration:frame.animationDuration,
            buttonAnimationName:getComputedStyle(el).animationName,
            buttonAnimationDuration:getComputedStyle(el).animationDuration
          };
        }"""
    )
    nav_cta.evaluate("el => { el.classList.remove('cta-persistent'); void el.offsetWidth; el.classList.add('cta-persistent'); }")
    page.wait_for_timeout(570)
    nav_pulse_style = nav_cta.evaluate(
        "el => ({scale:getComputedStyle(el).scale,filter:getComputedStyle(el).filter})"
    )
    page.screenshot(path=str(motion_dir / "nav-vip-pulse-mobile.png"))
    page.wait_for_timeout(650)
    nav_rest_style = nav_cta.evaluate(
        "el => ({scale:getComputedStyle(el).scale,filter:getComputedStyle(el).filter})"
    )

    hero_cta = page.locator(".hero [data-cta-mobile-persistent]")
    place_at_read_line(".hero [data-cta-mobile-persistent]", .64)
    page.wait_for_function(
        "() => document.querySelector('.hero [data-cta-mobile-persistent]')?.classList.contains('cta-persistent')",
        timeout=3_500,
    )
    hero_mobile_persistent = hero_cta.evaluate(
        """el => ({
          armed:el.classList.contains('cta-persistent'),
          animationName:getComputedStyle(el).animationName,
          animationDuration:getComputedStyle(el).animationDuration
        })"""
    )
    hero_cta.evaluate("el => { el.classList.remove('cta-persistent'); void el.offsetWidth; el.classList.add('cta-persistent'); }")
    page.wait_for_timeout(570)
    page.screenshot(path=str(motion_dir / "hero-groups-pulse-mobile.png"))

    place_at_read_line(first)
    page.wait_for_timeout(1_050)
    after_first = {"first": opacity(first), "second": opacity(second), "third": opacity(third)}
    page.screenshot(path=str(motion_dir / "mobile-first-card-only.png"))

    place_at_read_line(second)
    page.wait_for_timeout(1_050)
    after_second = {"first": opacity(first), "second": opacity(second), "third": opacity(third)}

    cta = page.locator(".community [data-cta-attention]")
    place_at_read_line(".community [data-cta-attention]", .64)
    page.wait_for_function(
        "() => document.querySelector('.community [data-cta-attention]')?.classList.contains('cta-signal')",
        timeout=3_500,
    )
    cta_signal = cta.evaluate("el => el.classList.contains('cta-signal')")
    page.wait_for_timeout(500)
    cta_peak_style = cta.evaluate(
        """el => {
          const css = getComputedStyle(el,'::after');
          return {opacity:parseFloat(css.opacity),transform:css.transform};
        }"""
    )
    page.screenshot(path=str(motion_dir / "cta-shot-clock-mobile.png"))

    full_access_cta = page.locator(".plan.featured [data-cta-persistent]")
    place_at_read_line(".plan.featured [data-cta-persistent]", .64)
    page.wait_for_function(
        "() => document.querySelector('.plan.featured [data-cta-persistent]')?.classList.contains('cta-persistent')",
        timeout=3_500,
    )
    full_access_persistent = full_access_cta.evaluate(
        """el => ({
          armed:el.classList.contains('cta-persistent'),
          animationName:getComputedStyle(el,'::after').animationName,
          buttonAnimationName:getComputedStyle(el).animationName,
          cardAnimationName:getComputedStyle(el.closest('.plan.featured')).animationName
        })"""
    )
    full_access_cta.evaluate("el => { el.classList.remove('cta-persistent'); void el.offsetWidth; el.classList.add('cta-persistent'); }")
    page.wait_for_timeout(570)
    page.screenshot(path=str(motion_dir / "full-access-vip-pulse-mobile.png"))

    cta_hierarchy = page.evaluate(
        """() => ({
          persistentTotal:document.querySelectorAll('[data-cta-persistent]').length,
          persistentInPlans:document.querySelectorAll('.plan [data-cta-persistent]').length,
          attentionOutsideFeaturedPlans:document.querySelectorAll('.plan:not(.featured) [data-cta-attention]').length,
          featuredIsPersistent:!!document.querySelector('.plan.featured [data-cta-persistent]'),
          finalIsPersistent:!!document.querySelector('.final [data-cta-persistent]'),
          heroHasMobilePersistentOptIn:!!document.querySelector('.hero [data-cta-mobile-persistent]'),
          communityRemainsShort:!document.querySelector('.community [data-cta-mobile-persistent],.community [data-cta-persistent]')
        })"""
    )

    return {
        "afterFirstCard": after_first,
        "afterSecondCard": after_second,
        "navPersistent": nav_persistent,
        "navPulseStyle": nav_pulse_style,
        "navRestStyle": nav_rest_style,
        "heroMobilePersistent": hero_mobile_persistent,
        "ctaSignalArmed": cta_signal,
        "ctaPeakStyle": cta_peak_style,
        "fullAccessPersistent": full_access_persistent,
        "ctaHierarchy": cta_hierarchy,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
    }


def audit_reduced_motion(page: Page, base_url: str) -> dict:
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    for attempt in range(2):
        try:
            page.goto(base_url, wait_until="commit", timeout=10_000)
            break
        except Exception:
            if attempt:
                raise
            page.wait_for_timeout(350)
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        page.locator("main").wait_for(state="attached", timeout=3_000)
    page.wait_for_function("() => typeof window.LUKA !== 'undefined'", timeout=15_000)
    try:
        page.locator(".preloader").wait_for(state="detached", timeout=4_000)
    except Exception:
        pass

    for _, selector in SECTIONS:
        page.locator(selector).first.scroll_into_view_if_needed()
        page.wait_for_timeout(40)

    motion = page.evaluate(
        """
        () => {
          const hiddenReveals = [...document.querySelectorAll('.reveal,.stagger>*')].filter((el) => {
            const css = getComputedStyle(el);
            return parseFloat(css.opacity || '1') < .99 || css.transform !== 'none';
          });
          const animationName = (selector, pseudo = null) => {
            const el = document.querySelector(selector);
            return el ? getComputedStyle(el, pseudo).animationName : null;
          };
          return {
            reducedMotionMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
            hiddenRevealCount: hiddenReveals.length,
            scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
            animations: {
              grain: animationName('body', '::after'),
              ticker: animationName('.plantao-track'),
              testimonials: animationName('.voices-track'),
              featuredPlan: animationName('.plan.featured'),
              ctaFrame: animationName('.btn-attention', '::after'),
              ctaButton: animationName('[data-cta-persistent]')
            }
          };
        }
        """
    )

    page.evaluate("scrollTo(0,0); document.activeElement && document.activeElement.blur()")
    page.keyboard.press("Tab")
    keyboard = page.evaluate(
        """() => ({
          activeClass: document.activeElement?.className || '',
          activeText: document.activeElement?.textContent?.trim() || ''
        })"""
    )
    page.keyboard.press("Enter")
    page.wait_for_timeout(80)
    keyboard["hashAfterActivation"] = page.evaluate("location.hash")

    return {
        "motion": motion,
        "keyboardSkipLink": keyboard,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:4173")
    parser.add_argument("--output", default="artifacts/ui-audit")
    parser.add_argument(
        "--only",
        choices=("all", "viewports", "entry", "reduced"),
        default="all",
    )
    parser.add_argument("--viewport", choices=tuple(VIEWPORTS), default=None)
    args = parser.parse_args()

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "report.json"
    if args.only != "all" and report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
    else:
        report = {}

    with sync_playwright() as playwright:
        if args.only in ("all", "viewports"):
            browser = playwright.chromium.launch(headless=True)
            for name, viewport in VIEWPORTS.items():
                if args.viewport and name != args.viewport:
                    continue
                context = browser.new_context(viewport=viewport, device_scale_factor=1)
                page = context.new_page()
                report[name] = audit_viewport(page, name, output, args.base_url)
                context.close()
                save_report(output, report)
            browser.close()

        if args.only in ("all", "entry"):
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=1,
            )
            report["entry-timing-mobile"] = audit_mobile_entry_timing(
                context.new_page(), output, args.base_url
            )
            context.close()
            browser.close()
            save_report(output, report)

        if args.only in ("all", "reduced"):
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=1,
                reduced_motion="reduce",
            )
            report["reduced-motion-mobile"] = audit_reduced_motion(
                context.new_page(), args.base_url
            )
            context.close()
            browser.close()

    report_path = save_report(output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nReport: {report_path}")


if __name__ == "__main__":
    main()
