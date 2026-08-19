using System.IO;
using System.Text.Json;
using System.Windows;
using AI_Training.Gui.Services;

namespace AI_Training.Gui;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var apiBaseUrl = LoadApiBaseUrl();
        var apiClient = new ApiClient(apiBaseUrl);

        var loginWindow = new LoginWindow(apiClient);
        loginWindow.Show();
    }

    private static string LoadApiBaseUrl()
    {
        const string fallback = "http://localhost:8082/api";
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            if (!File.Exists(path))
            {
                return fallback;
            }

            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            return doc.RootElement.TryGetProperty("ApiBaseUrl", out var value)
                ? value.GetString() ?? fallback
                : fallback;
        }
        catch (JsonException)
        {
            return fallback;
        }
    }
}
