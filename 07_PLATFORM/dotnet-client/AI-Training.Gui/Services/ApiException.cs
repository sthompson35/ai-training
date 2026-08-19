namespace AI_Training.Gui.Services;

public class ApiException : Exception
{
    public ApiException(string message) : base(message)
    {
    }
}
