using System.Collections.ObjectModel;
using System.Windows;
using AI_Training.Gui.Models;
using AI_Training.Gui.Services;

namespace AI_Training.Gui;

public partial class MainWindow : Window
{
    private readonly ApiClient _apiClient;
    private readonly ObservableCollection<Level> _levels = new();

    public MainWindow(ApiClient apiClient, string username)
    {
        InitializeComponent();
        _apiClient = apiClient;
        HeaderText.Text = $"Logged in as {username}";
        LevelsGrid.ItemsSource = _levels;
        Loaded += async (_, _) => await LoadLevelsAsync();
    }

    private async void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        await LoadLevelsAsync();
    }

    private async Task LoadLevelsAsync()
    {
        ErrorText.Text = string.Empty;
        RefreshButton.IsEnabled = false;
        try
        {
            var levels = await _apiClient.GetLevelsAsync();
            _levels.Clear();
            foreach (var level in levels)
            {
                _levels.Add(level);
            }
        }
        catch (Exception ex)
        {
            ErrorText.Text = ex.Message;
        }
        finally
        {
            RefreshButton.IsEnabled = true;
        }
    }
}
