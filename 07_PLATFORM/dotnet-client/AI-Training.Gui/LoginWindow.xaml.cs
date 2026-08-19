using System.Windows;
using AI_Training.Gui.Services;

namespace AI_Training.Gui;

public partial class LoginWindow : Window
{
    private readonly ApiClient _apiClient;

    public LoginWindow(ApiClient apiClient)
    {
        InitializeComponent();
        _apiClient = apiClient;
    }

    private async void LoginButton_Click(object sender, RoutedEventArgs e)
    {
        ErrorText.Text = string.Empty;
        LoginButton.IsEnabled = false;
        try
        {
            var login = await _apiClient.LoginAsync(UsernameBox.Text, PasswordBox.Password);
            var mainWindow = new MainWindow(_apiClient, login.Username);
            mainWindow.Show();
            Close();
        }
        catch (Exception ex)
        {
            ErrorText.Text = ex.Message;
        }
        finally
        {
            LoginButton.IsEnabled = true;
        }
    }
}
