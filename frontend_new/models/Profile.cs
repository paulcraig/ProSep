using System.Text.Json.Serialization;

namespace Frontend.Models
{
    public class Profile
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
        [JsonPropertyName("title")]
        public string? Title { get; set; }
        [JsonPropertyName("role")]
        public string? Role { get; set; }
        [JsonPropertyName("current")]
        public bool Current { get; set; }
        [JsonPropertyName("about")]
        public string? About { get; set; }
        [JsonPropertyName("email")]
        public string? Email { get; set; }
        [JsonPropertyName("phone")]
        public string? Phone { get; set; }
        [JsonPropertyName("location")]
        public string? Location { get; set; }
    }
}