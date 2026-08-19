using System.Text.Json.Serialization;

namespace AI_Training.Gui.Models;

public class Level
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
}
