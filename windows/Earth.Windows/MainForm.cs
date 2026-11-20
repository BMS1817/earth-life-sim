using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Earth.Windows;

internal sealed class MainForm : Form
{
    private const string GameHost = "earth.one-life";
    private readonly WebView2 webView = new();

    internal MainForm()
    {
        Text = "Earth — One Life";
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1280, 900);
        MinimumSize = new Size(360, 640);
        webView.Dock = DockStyle.Fill;
        webView.AccessibleName = "EarthGame";
        Controls.Add(webView);
        Shown += async (_, _) => await InitializeGameAsync();
    }

    private async Task InitializeGameAsync()
    {
        try
        {
            string appDirectory = Path.Combine(AppContext.BaseDirectory, "app");
            if (!File.Exists(Path.Combine(appDirectory, "index.html"))) throw new FileNotFoundException("The local game package is missing.");
            string userData = Environment.GetEnvironmentVariable("EARTH_USER_DATA") ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Earth One Life",
                "WebView2");
            Directory.CreateDirectory(userData);
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(browserExecutableFolder: null, userDataFolder: userData);
            await webView.EnsureCoreWebView2Async(environment);
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.__EARTH_DESKTOP__=true;");
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(GameHost, appDirectory, CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.Profile.DefaultDownloadFolderPath = Environment.GetEnvironmentVariable("EARTH_DOWNLOADS") ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "Downloads");
            webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenExternal(args.Uri);
            };
            webView.CoreWebView2.NavigationStarting += (_, args) =>
            {
                if (!args.Uri.StartsWith($"https://{GameHost}/", StringComparison.OrdinalIgnoreCase))
                {
                    args.Cancel = true;
                    OpenExternal(args.Uri);
                }
            };
            webView.Source = new Uri($"https://{GameHost}/index.html");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            const string message = "Для Earth нужен Microsoft Edge WebView2 Runtime. Открыть официальную страницу установки?\n\nEarth requires Microsoft Edge WebView2 Runtime. Open the official installation page?";
            if (MessageBox.Show(this, message, "Earth — WebView2", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
            {
                OpenExternal("https://developer.microsoft.com/microsoft-edge/webview2/");
            }
            Close();
        }
        catch (Exception error)
        {
            MessageBox.Show(this, $"Не удалось запустить Earth.\nEarth could not start.\n\n{error.Message}", "Earth", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private static void OpenExternal(string uri)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out Uri? target) || target.Scheme != Uri.UriSchemeHttps) return;
        Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
    }
}
