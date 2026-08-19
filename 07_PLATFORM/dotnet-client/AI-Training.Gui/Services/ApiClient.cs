using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using AI_Training.Gui.Models;

namespace AI_Training.Gui.Services;

public class ApiClient
{
    private readonly HttpClient _http;

    public ApiClient(HttpClient httpClient)
    {
        _http = httpClient;
    }

    public ApiClient(string baseUrl)
        : this(new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/") })
    {
    }

    public async Task<LoginResponse> LoginAsync(string username, string password)
    {
        // HttpClient resolves a leading-slash relative URI against the host root,
        // discarding BaseAddress's own path (e.g. "/api") — so these must be
        // relative paths without a leading slash to stay under BaseAddress.
        var response = await _http.PostAsJsonAsync(
            "v1/auth/login",
            new { username, password });

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new ApiException(ExtractDetail(body) ?? $"Login failed ({(int)response.StatusCode}).");
        }

        return (await response.Content.ReadFromJsonAsync<LoginResponse>())
            ?? throw new ApiException("Login response was empty.");
    }

    public async Task<List<Level>> GetLevelsAsync()
    {
        var response = await _http.GetAsync("v1/levels");
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new ApiException(ExtractDetail(body) ?? $"Request failed ({(int)response.StatusCode}).");
        }

        return (await response.Content.ReadFromJsonAsync<List<Level>>()) ?? new List<Level>();
    }

    // Mirrors the web client's extractErrorMessage (lib/api.ts): the backend's
    // `detail` field is usually a plain string, but FastAPI's own request-validation
    // 422s shape it as a list of {msg, ...} objects instead — handle both rather
    // than falling back to a generic message for that whole error class.
    private static string? ExtractDetail(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("detail", out var detail))
            {
                return null;
            }

            if (detail.ValueKind == JsonValueKind.String)
            {
                return detail.GetString();
            }

            if (detail.ValueKind == JsonValueKind.Array)
            {
                var messages = detail.EnumerateArray()
                    .Select(item => item.TryGetProperty("msg", out var msg) ? msg.GetString() : null)
                    .Where(msg => !string.IsNullOrEmpty(msg));
                var joined = string.Join(", ", messages);
                return string.IsNullOrEmpty(joined) ? null : joined;
            }

            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
