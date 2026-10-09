import csv
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

import trackio


def test_histogram_history_navigation_and_export(temp_dir):
    trackio.init(project="histogram_history", name="run")
    for step, counts in [(10, [1, 9]), (20, [9, 1]), (30, [5, 5])]:
        trackio.log({"distribution": trackio.Histogram(np_histogram=(counts, [0, 1, 2]))}, step=step)
    trackio.finish()
    app, _, _, url = trackio.show(
        project="histogram_history", block_thread=False, open_browser=False,
        host="127.0.0.1", server_port=17869,
    )
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page()
            page.goto(url)
            selector = page.get_by_label("Histogram step", exact=True)
            expect(selector).to_have_value("latest")
            expect(selector.locator("option")).to_have_text(["Latest", "10", "20", "30"])
            canvas = page.locator(".histogram-plot canvas")
            expect(canvas).to_be_visible()
            latest_image = canvas.evaluate("el => el.toDataURL()")
            selector.select_option("10")
            expect(page.get_by_label("Histogram history", exact=True)).to_have_value("0")
            page.wait_for_function(
                "previous => document.querySelector('.histogram-plot canvas').toDataURL() !== previous",
                arg=latest_image,
            )
            page.get_by_label("Histogram history", exact=True).fill("1")
            expect(selector).to_have_value("20")
            slice_image = canvas.evaluate("el => el.toDataURL()")
            page.get_by_role("button", name="All steps", exact=True).click()
            expect(selector).to_have_count(0)
            expect(page.get_by_role("button", name="All steps", exact=True)).to_have_attribute("aria-pressed", "true")
            page.wait_for_function(
                "previous => document.querySelector('.histogram-plot canvas').toDataURL() !== previous",
                arg=slice_image,
            )
            page.get_by_role("button", name="All steps", exact=True).click()
            expect(selector).to_have_value("20")
            page.get_by_role("button", name="Open this chart in the browser's fullscreen mode").click()
            expect(selector).to_have_value("20")
            expect(page.locator(".fullscreen-host canvas")).to_be_visible()
            page.get_by_role("button", name="Exit fullscreen and return to the metrics view").click()
            expect(selector).to_have_value("20")
            with page.expect_download() as download:
                page.get_by_role("button", name="Download full histogram history as CSV").click()
            with Path(download.value.path()).open() as file:
                rows = list(csv.DictReader(file))
            assert len(rows) == 6
            assert {row["step"] for row in rows} == {"10", "20", "30"}
            trackio.init(project="histogram_history", name="run", resume="must")
            trackio.log({"distribution": trackio.Histogram(np_histogram=([2, 8], [0, 1, 2]))}, step=40)
            trackio.finish()
            expect(selector.locator("option")).to_have_count(5, timeout=20000)
            expect(selector).to_have_value("20")
            selector.select_option("latest")
            expect(page.get_by_label("Histogram history", exact=True)).to_have_value("3")
            trackio.init(project="histogram_history", name="run", resume="must")
            trackio.log({"distribution": trackio.Histogram(np_histogram=([8, 2], [0, 1, 2]))}, step=50)
            trackio.finish()
            expect(selector.locator("option")).to_have_count(6, timeout=20000)
            expect(selector).to_have_value("latest")
            expect(page.get_by_label("Histogram history", exact=True)).to_have_value("4")
            browser.close()
    finally:
        app.close()
