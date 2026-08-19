using System.Net;
using AI_Training.Gui.Services;

namespace AI_Training.Gui.Tests;

public class ApiClientTests
{
    private static ApiClient MakeClient(FakeHttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:8082/api/") };
        return new ApiClient(httpClient);
    }

    [Fact]
    public async Task LoginAsync_ReturnsParsedResponse_OnSuccess()
    {
        var handler = new FakeHttpMessageHandler(
            HttpStatusCode.OK,
            """{"access_token":"tok123","token_type":"bearer","username":"admin","role":"admin"}""");
        var client = MakeClient(handler);

        var result = await client.LoginAsync("admin", "password");

        Assert.Equal("tok123", result.AccessToken);
        Assert.Equal("bearer", result.TokenType);
        Assert.Equal("admin", result.Username);
        Assert.Equal("admin", result.Role);
    }

    [Fact]
    public async Task LoginAsync_ThrowsApiExceptionWithBackendDetail_OnFailure()
    {
        var handler = new FakeHttpMessageHandler(
            HttpStatusCode.Unauthorized,
            """{"detail":"Incorrect username or password"}""");
        var client = MakeClient(handler);

        var ex = await Assert.ThrowsAsync<ApiException>(() => client.LoginAsync("admin", "wrong"));

        Assert.Equal("Incorrect username or password", ex.Message);
    }

    [Fact]
    public async Task GetLevelsAsync_ReturnsParsedList_OnSuccess()
    {
        var handler = new FakeHttpMessageHandler(
            HttpStatusCode.OK,
            """[{"id":"L1","title":"Foundations"},{"id":"L2","title":"Advanced"}]""");
        var client = MakeClient(handler);

        var levels = await client.GetLevelsAsync();

        Assert.Equal(2, levels.Count);
        Assert.Equal("Foundations", levels[0].Title);
        Assert.Equal("L2", levels[1].Id);
    }
}
